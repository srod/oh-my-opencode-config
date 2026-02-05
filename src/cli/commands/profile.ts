import path from "node:path"
import { cancel, confirm, isCancel, outro, select, text } from "@clack/prompts"
import chalk from "chalk"
import type { BaseCommandOptions } from "#cli/types.js"
import { loadConfig } from "#config/loader.js"
import { resolveConfigPath } from "#config/resolve.js"
import { handleError } from "#errors/handlers.js"
import { InvalidConfigError } from "#errors/types.js"
import {
  PROFILE_NAME_MAX_LENGTH,
  PROFILE_NAME_REGEX,
  PROFILE_TEMPLATE_FILE_NAME,
} from "#profile/constants.js"
import {
  deleteProfile,
  listProfiles,
  ProfileError,
  ProfileNotFoundError,
  renameProfile,
  saveProfile,
  useProfile,
} from "#profile/manager.js"
import { atomicWrite, fileExists } from "#utils/fs.js"
import { printBlank, printLine } from "#utils/output.js"

/**
 * Gets the directory portion of a configuration file path.
 *
 * @param configPath - The full path to the configuration file
 * @returns The directory portion of `configPath`
 */
function getConfigDir(configPath: string): string {
  return path.dirname(configPath)
}

/**
 * Checks whether a candidate path resides within (or is equal to) a base directory.
 *
 * @param candidatePath - The path to test (absolute or relative)
 * @param baseDir - The directory to test against (absolute or relative)
 * @returns `true` if `candidatePath` is the same as `baseDir` or is located inside `baseDir`, `false` otherwise
 */
function isWithinDir(candidatePath: string, baseDir: string): boolean {
  const relative = path.relative(baseDir, candidatePath)
  if (relative === "") {
    return true
  }
  return !relative.startsWith("..") && !path.isAbsolute(relative)
}

/**
 * Resolves the filesystem path where a profile template should be written.
 *
 * @param configDir - Base configuration directory used to resolve relative overrides.
 * @param templateOverride - Optional absolute path or path relative to `configDir` to override the default template location.
 * @returns The absolute path to the resolved template file.
 * @throws InvalidConfigError if the resolved path is not located inside `configDir`.
 */
function resolveTemplateOutputPath(configDir: string, templateOverride?: string): string {
  const configDirResolved = path.resolve(configDir)
  const trimmedOverride = templateOverride?.trim()
  const candidate = trimmedOverride
    ? path.isAbsolute(trimmedOverride)
      ? path.resolve(trimmedOverride)
      : path.resolve(configDirResolved, trimmedOverride)
    : path.resolve(configDirResolved, PROFILE_TEMPLATE_FILE_NAME)

  if (!isWithinDir(candidate, configDirResolved)) {
    throw new InvalidConfigError(`Template path must be within ${configDirResolved}`)
  }

  return candidate
}

/**
 * Validates a candidate profile name.
 *
 * @param value - The profile name to validate (may be undefined)
 * @returns `undefined` if the name is valid; otherwise an error message string or an `Error` describing why the name is invalid (missing, too long, or containing disallowed characters)
 */
function validateProfileNameInput(value: string | undefined): string | Error | undefined {
  if (!value || value.length === 0) {
    return "Profile name is required"
  }
  if (value.length > PROFILE_NAME_MAX_LENGTH) {
    return `Profile name must be ${PROFILE_NAME_MAX_LENGTH} characters or less`
  }
  if (!PROFILE_NAME_REGEX.test(value)) {
    return "Profile name must contain only letters, numbers, hyphens, and underscores"
  }
  return undefined
}

/**
 * Saves the current configuration as a named profile, prompting the user for a name if none is provided.
 *
 * @param options - Command options. `options.template` may be a path to associate a template file with the saved profile.
 * @param name - Optional profile name; if omitted the user will be prompted to enter one.
 */
export async function profileSaveCommand(
  options: Pick<BaseCommandOptions, "config" | "verbose" | "template">,
  name?: string,
): Promise<void> {
  try {
    const configPath = resolveConfigPath(options.config)
    const configDir = getConfigDir(configPath)
    const config = await loadConfig(configPath)

    if (!name) {
      const inputName = await text({
        message: "Enter a name for this profile",
        validate: validateProfileNameInput,
      })

      if (isCancel(inputName)) {
        cancel("Operation cancelled.")
        return
      }

      name = inputName
    }

    await saveProfile(configDir, name, config, {
      configPath,
      templatePath: options.template,
    })
    outro(chalk.green(`Profile "${name}" saved successfully.`))
  } catch (error) {
    if (error instanceof ProfileError) {
      cancel(error.message)
      return
    }
    handleError(error, { verbose: options.verbose })
  }
}

/**
 * Save the current configuration as a template file inside the configuration directory.
 *
 * If a template already exists, prompts for confirmation before overwriting. When `options.dryRun`
 * is true, reports whether it would create or overwrite the template without writing any files.
 *
 * @param options - Options containing the resolved config path (`config`), a verbose flag (`verbose`),
 *   a `dryRun` flag that causes the command to only report intended actions, and an optional `template`
 *   path override for the template destination
 */
export async function profileTemplateCommand(
  options: Pick<BaseCommandOptions, "config" | "verbose" | "dryRun" | "template">,
): Promise<void> {
  try {
    const configPath = resolveConfigPath(options.config)
    const configDir = getConfigDir(configPath)
    const templatePath = resolveTemplateOutputPath(configDir, options.template)
    const config = await loadConfig(configPath)

    const exists = await fileExists(templatePath)
    if (options.dryRun) {
      const action = exists ? "overwrite" : "create"
      outro(chalk.yellow(`Dry run: Would ${action} template at ${templatePath}.`))
      return
    }

    if (exists) {
      const overwrite = await confirm({
        message: `Template already exists at ${templatePath}. Overwrite?`,
        initialValue: false,
      })

      if (isCancel(overwrite) || !overwrite) {
        cancel("Operation cancelled.")
        return
      }
    }

    await atomicWrite(templatePath, JSON.stringify(config, null, 2))
    outro(chalk.green(`Template saved to ${templatePath}.`))
  } catch (error) {
    handleError(error, { verbose: options.verbose })
  }
}

/**
 * Activate a saved profile by name or prompt the user to choose one.
 *
 * If `name` is provided, that profile is activated; otherwise the user is prompted
 * to select from existing profiles. If no profiles exist the command prints a
 * warning and exits. On success a confirmation message is displayed. If the
 * selected profile cannot be found the operation is cancelled with an error message.
 *
 * @param name - Optional profile name to activate; if omitted the user will be prompted
 */
export async function profileUseCommand(
  options: Pick<BaseCommandOptions, "config" | "verbose">,
  name?: string,
): Promise<void> {
  try {
    const configPath = resolveConfigPath(options.config)
    const configDir = getConfigDir(configPath)

    if (!name) {
      const profiles = await listProfiles(configDir)

      if (profiles.length === 0) {
        outro(chalk.yellow("No profiles found. Create one with 'profile save <name>' first."))
        return
      }

      const selection = await select({
        message: "Select a profile to use",
        options: profiles.map((p) => ({
          value: p.name,
          label: p.isActive ? `${p.name} (active)` : p.name,
          hint: p.isActive ? "currently active" : undefined,
        })),
      })

      if (isCancel(selection)) {
        cancel("Operation cancelled.")
        return
      }

      name = selection
    }

    await useProfile(configDir, name)
    outro(chalk.green(`Now using profile "${name}".`))
  } catch (error) {
    if (error instanceof ProfileNotFoundError) {
      cancel(error.message)
      return
    }
    handleError(error, { verbose: options.verbose })
  }
}

export async function profileListCommand(
  options: Pick<BaseCommandOptions, "config" | "json">,
): Promise<void> {
  try {
    const configPath = resolveConfigPath(options.config)
    const configDir = getConfigDir(configPath)
    const profiles = await listProfiles(configDir)

    if (options.json) {
      printLine(
        JSON.stringify(
          profiles.map((p) => ({
            name: p.name,
            isActive: p.isActive,
            created: p.created.toISOString(),
          })),
          null,
          2,
        ),
      )
      return
    }

    if (profiles.length === 0) {
      outro(chalk.yellow("No profiles found."))
      return
    }

    printBlank()
    printLine(chalk.bold(`Profiles for: ${chalk.cyan(configDir)}`))
    printBlank()

    const maxNameLength = Math.max(...profiles.map((p) => p.name.length))

    for (const profile of profiles) {
      const marker = profile.isActive ? chalk.green("* ") : "  "
      const namePadded = profile.name.padEnd(maxNameLength + 2)
      const createdStr = profile.created.toLocaleString()
      printLine(`${marker}${chalk.cyan(namePadded)} ${chalk.dim(createdStr)}`)
    }

    printBlank()
    printLine(chalk.dim("* indicates active profile"))
  } catch (error) {
    handleError(error, { verbose: false })
  }
}

export async function profileDeleteCommand(
  options: Pick<BaseCommandOptions, "config" | "verbose" | "dryRun">,
  name?: string,
): Promise<void> {
  try {
    const configPath = resolveConfigPath(options.config)
    const configDir = getConfigDir(configPath)

    if (!name) {
      const profiles = await listProfiles(configDir)

      if (profiles.length === 0) {
        outro(chalk.yellow("No profiles found."))
        return
      }

      const deletableProfiles = profiles.filter((p) => !p.isActive)

      if (deletableProfiles.length === 0) {
        outro(
          chalk.yellow(
            "Cannot delete the only profile while it's active. Switch to another profile first.",
          ),
        )
        return
      }

      const selection = await select({
        message: "Select a profile to delete",
        options: deletableProfiles.map((p) => ({
          value: p.name,
          label: p.name,
        })),
      })

      if (isCancel(selection)) {
        cancel("Operation cancelled.")
        return
      }

      name = selection
    }

    const confirmed = await confirm({
      message: `Delete profile "${name}"?`,
      initialValue: false,
    })

    if (isCancel(confirmed) || !confirmed) {
      cancel("Operation cancelled.")
      return
    }

    if (options.dryRun) {
      outro(chalk.yellow(`Dry run: Would delete profile "${name}".`))
      return
    }

    await deleteProfile(configDir, name)
    outro(chalk.green(`Profile "${name}" deleted.`))
  } catch (error) {
    if (error instanceof ProfileError) {
      cancel(error.message)
      return
    }
    handleError(error, { verbose: options.verbose })
  }
}

export async function profileRenameCommand(
  options: Pick<BaseCommandOptions, "config" | "verbose">,
  oldName?: string,
  newName?: string,
): Promise<void> {
  try {
    const configPath = resolveConfigPath(options.config)
    const configDir = getConfigDir(configPath)

    if (!oldName) {
      const profiles = await listProfiles(configDir)

      if (profiles.length === 0) {
        outro(chalk.yellow("No profiles found."))
        return
      }

      const selection = await select({
        message: "Select a profile to rename",
        options: profiles.map((p) => ({
          value: p.name,
          label: p.name,
          hint: p.isActive ? "currently active" : undefined,
        })),
      })

      if (isCancel(selection)) {
        cancel("Operation cancelled.")
        return
      }

      oldName = selection
    }

    if (!newName) {
      const inputName = await text({
        message: `Enter new name for profile "${oldName}"`,
        validate: validateProfileNameInput,
      })

      if (isCancel(inputName)) {
        cancel("Operation cancelled.")
        return
      }

      newName = inputName
    }

    await renameProfile(configDir, oldName, newName)
    outro(chalk.green(`Profile "${oldName}" renamed to "${newName}".`))
  } catch (error) {
    if (error instanceof ProfileError) {
      cancel(error.message)
      return
    }
    handleError(error, { verbose: options.verbose })
  }
}