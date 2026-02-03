import fs from "node:fs/promises"
import path from "node:path"
import { InvalidConfigError, PermissionDeniedError } from "#errors/types.js"
import { type Config, ConfigSchema } from "#types/config.js"
import { atomicWrite, fileExists, isErrnoException } from "#utils/fs.js"
import {
  CONFIG_FILE_NAME,
  PROFILE_NAME_MAX_LENGTH,
  PROFILE_NAME_REGEX,
  RESERVED_PROFILE_NAMES,
} from "./constants.js"

export interface ProfileInfo {
  name: string
  isActive: boolean
  created: Date
}

export class ProfileError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "ProfileError"
  }
}

export class ProfileNameError extends ProfileError {
  constructor(name: string, reason: string) {
    super(`Invalid profile name "${name}": ${reason}`)
    this.name = "ProfileNameError"
  }
}

export class ProfileActiveError extends ProfileError {
  constructor(name: string) {
    super(`Cannot delete active profile "${name}". Switch to another profile first.`)
    this.name = "ProfileActiveError"
  }
}

export class ProfileNotFoundError extends ProfileError {
  constructor(name: string) {
    super(`Profile "${name}" not found`)
    this.name = "ProfileNotFoundError"
  }
}

export class ProfileExistsError extends ProfileError {
  constructor(name: string) {
    super(`Profile "${name}" already exists`)
    this.name = "ProfileExistsError"
  }
}

export class DanglingSymlinkError extends ProfileError {
  constructor(targetPath: string) {
    super(
      `Dangling symlink detected: target "${targetPath}" no longer exists. Please fix manually.`,
    )
    this.name = "DanglingSymlinkError"
  }
}

/**
 * Validate a profile name against the allowed pattern and reserved names.
 * @throws ProfileNameError if validation fails
 */
function validateProfileName(name: string): void {
  if (!PROFILE_NAME_REGEX.test(name)) {
    if (name.length === 0 || name.length > PROFILE_NAME_MAX_LENGTH) {
      throw new ProfileNameError(
        name,
        `must be between 1 and ${PROFILE_NAME_MAX_LENGTH} characters`,
      )
    }
    throw new ProfileNameError(name, "must contain only letters, numbers, hyphens, and underscores")
  }

  if (RESERVED_PROFILE_NAMES.has(name)) {
    throw new ProfileNameError(name, "is a reserved name")
  }
}

/**
 * Get the profile file path for a given profile name.
 */
function getProfilePath(configDir: string, name: string): string {
  return path.join(configDir, `oh-my-opencode-${name}.json`)
}

/**
 * Get the main config file path (the symlink location).
 */
function getConfigPath(configDir: string): string {
  return path.join(configDir, CONFIG_FILE_NAME)
}

/**
 * List all profile files in the config directory.
 * Returns array of profile names (without path or extension).
 */
async function findProfileNames(configDir: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(configDir)
    const profileNames: string[] = []

    for (const entry of entries) {
      const match = entry.match(/^oh-my-opencode-(.+)\.json$/)
      if (match?.[1]) {
        profileNames.push(match[1])
      }
    }

    return profileNames
  } catch {
    return []
  }
}

/**
 * Check if the main config file is a symlink and resolve its target.
 * Returns the profile name if it points to a profile file, or null.
 * Handles dangling symlinks and non-profile symlinks.
 * @throws DanglingSymlinkError if symlink points to non-existent target
 */
async function resolveActiveProfileName(configDir: string): Promise<string | null> {
  const configPath = getConfigPath(configDir)

  try {
    const stats = await fs.lstat(configPath)
    if (!stats.isSymbolicLink()) {
      return null
    }

    const target = await fs.readlink(configPath)
    const targetBasename = path.basename(target)

    // Check if target exists
    const targetExists = await fileExists(target)

    if (!targetExists) {
      throw new DanglingSymlinkError(target)
    }

    // Check if target is a profile file (oh-my-opencode-{name}.json)
    const match = targetBasename.match(/^oh-my-opencode-(.+)\.json$/)
    if (match?.[1]) {
      return match[1]
    }

    // Symlink points to non-profile file
    return null
  } catch (error) {
    if (error instanceof DanglingSymlinkError) {
      throw error
    }
    return null
  }
}

/**
 * Get the creation date of a profile file.
 */
async function getProfileCreatedDate(configDir: string, name: string): Promise<Date> {
  const profilePath = getProfilePath(configDir, name)
  const stats = await fs.stat(profilePath)
  return stats.birthtime
}

/**
 * Atomic symlink update using temp symlink + rename pattern.
 */
async function atomicSymlinkUpdate(targetPath: string, linkPath: string): Promise<void> {
  const tmpLinkPath = `${linkPath}.tmp.link`

  try {
    await fs.symlink(targetPath, tmpLinkPath)
    await fs.rename(tmpLinkPath, linkPath)
  } catch (error) {
    // Clean up temp symlink on error
    try {
      await fs.unlink(tmpLinkPath)
    } catch {}

    if (isErrnoException(error)) {
      if (error.code === "EACCES") {
        throw new PermissionDeniedError(linkPath, "create symlink")
      }
      if (error.code === "EPERM") {
        // Windows or permission issues
        throw new PermissionDeniedError(linkPath, "create symlink")
      }
    }
    throw error
  }
}

/**
 * Read the current config file content as string.
 * Returns null if file doesn't exist.
 */
async function readConfigContent(configPath: string): Promise<string | null> {
  try {
    const file = Bun.file(configPath)
    if (!(await file.exists())) {
      return null
    }
    return await file.text()
  } catch {
    return null
  }
}

/**
 * Save the current configuration as a named profile.
 * Auto-creates "default" profile on first save if no profiles exist.
 * @throws ProfileNameError if name is invalid
 * @throws InvalidConfigError if config fails Zod validation
 * @throws ProfileExistsError if profile already exists (optional, for overwrite protection)
 */
export async function saveProfile(configDir: string, name: string, config: Config): Promise<void> {
  validateProfileName(name)

  // Validate config with Zod before saving
  const validationResult = ConfigSchema.safeParse(config)
  if (!validationResult.success) {
    throw new InvalidConfigError(`Config validation failed: ${validationResult.error.message}`)
  }

  // Check if this is the first profile save (auto-create default)
  const existingProfiles = await findProfileNames(configDir)
  if (existingProfiles.length === 0 && name !== "default") {
    // Auto-create default profile from current config
    const defaultProfilePath = getProfilePath(configDir, "default")
    const configPath = getConfigPath(configDir)
    const currentContent = await readConfigContent(configPath)

    if (currentContent) {
      await atomicWrite(defaultProfilePath, currentContent)
    } else {
      // No current config, save the provided config as default too
      await atomicWrite(defaultProfilePath, JSON.stringify(config, null, 2))
    }
  }

  // Save the requested profile
  const profilePath = getProfilePath(configDir, name)
  const content = JSON.stringify(config, null, 2)
  await atomicWrite(profilePath, content)
}

/**
 * Switch to a named profile by updating the symlink.
 * @throws ProfileNotFoundError if profile doesn't exist
 * @throws DanglingSymlinkError if current symlink is dangling
 */
export async function useProfile(configDir: string, name: string): Promise<void> {
  validateProfileName(name)

  // Check if target profile exists
  const profilePath = getProfilePath(configDir, name)
  const profileExists = await fileExists(profilePath)

  if (!profileExists) {
    throw new ProfileNotFoundError(name)
  }

  // Create/Update symlink atomically
  const configPathResolved = getConfigPath(configDir)

  try {
    await atomicSymlinkUpdate(profilePath, configPathResolved)
  } catch (error) {
    if (error instanceof PermissionDeniedError) {
      throw error
    }
    throw new ProfileError(
      `Failed to switch to profile "${name}": ${error instanceof Error ? error.message : String(error)}`,
    )
  }
}

/**
 * List all available profiles with their active status.
 * @throws DanglingSymlinkError if active profile symlink is dangling
 */
export async function listProfiles(configDir: string): Promise<ProfileInfo[]> {
  const profileNames = await findProfileNames(configDir)
  const activeName = await resolveActiveProfileName(configDir)

  const profiles: ProfileInfo[] = []

  for (const name of profileNames) {
    const created = await getProfileCreatedDate(configDir, name)
    profiles.push({
      name,
      isActive: name === activeName,
      created,
    })
  }

  // Sort by creation date (oldest first)
  profiles.sort((a, b) => a.created.getTime() - b.created.getTime())

  return profiles
}

/**
 * Delete a profile.
 * Cannot delete the active profile.
 * @throws ProfileNotFoundError if profile doesn't exist
 * @throws ProfileActiveError if trying to delete active profile
 */
export async function deleteProfile(configDir: string, name: string): Promise<void> {
  validateProfileName(name)

  const profilePath = getProfilePath(configDir, name)

  // Check if profile exists
  const profileExists = await fileExists(profilePath)

  if (!profileExists) {
    throw new ProfileNotFoundError(name)
  }

  // Check if this is the active profile
  const activeName = await resolveActiveProfileName(configDir)
  if (name === activeName) {
    throw new ProfileActiveError(name)
  }

  // Delete the profile file
  try {
    await fs.unlink(profilePath)
  } catch (error) {
    if (isErrnoException(error)) {
      if (error.code === "EACCES") {
        throw new PermissionDeniedError(profilePath, "delete")
      }
    }
    throw new ProfileError(
      `Failed to delete profile "${name}": ${error instanceof Error ? error.message : String(error)}`,
    )
  }
}

/**
 * Rename a profile.
 * If the profile is active, updates the symlink to point to the new name.
 * @throws ProfileNotFoundError if old profile doesn't exist
 * @throws ProfileExistsError if new profile name already exists
 * @throws ProfileNameError if new name is invalid
 */
export async function renameProfile(
  configDir: string,
  oldName: string,
  newName: string,
): Promise<void> {
  validateProfileName(oldName)
  validateProfileName(newName)

  const oldProfilePath = getProfilePath(configDir, oldName)
  const newProfilePath = getProfilePath(configDir, newName)

  // Check if old profile exists
  const oldExists = await fileExists(oldProfilePath)

  if (!oldExists) {
    throw new ProfileNotFoundError(oldName)
  }

  // Check if new profile name already exists
  const newExists = await fileExists(newProfilePath)

  if (newExists) {
    throw new ProfileExistsError(newName)
  }

  // Check if old profile is active
  const activeName = await resolveActiveProfileName(configDir)
  const isActive = oldName === activeName

  // Rename the file atomically
  try {
    await fs.rename(oldProfilePath, newProfilePath)
  } catch (error) {
    if (isErrnoException(error)) {
      if (error.code === "EACCES") {
        throw new PermissionDeniedError(oldProfilePath, "rename")
      }
    }
    throw new ProfileError(
      `Failed to rename profile "${oldName}" to "${newName}": ${error instanceof Error ? error.message : String(error)}`,
    )
  }

  // If it was the active profile, update the symlink atomically
  if (isActive) {
    const configPath = getConfigPath(configDir)
    try {
      await atomicSymlinkUpdate(newProfilePath, configPath)
    } catch (error) {
      // If symlink update fails, we already renamed the file
      // This leaves the system in an inconsistent state but the profile
      // can still be used - attempt to revert the rename for consistency
      try {
        await fs.rename(newProfilePath, oldProfilePath)
      } catch {}

      throw new ProfileError(
        `Failed to update active profile symlink after rename: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  }
}
