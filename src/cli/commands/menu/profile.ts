import path from "node:path"
import { isCancel, select, text } from "@clack/prompts"
import chalk from "chalk"
import { profileTemplateCommand } from "#cli/commands/profile.js"
import type { BaseCommandOptions } from "#cli/types.js"
import { loadConfig } from "#config/loader.js"
import { resolveConfigPath } from "#config/resolve.js"
import { PROFILE_NAME_MAX_LENGTH, PROFILE_NAME_REGEX } from "#profile/constants.js"
import {
  deleteProfile as deleteProfileFn,
  listProfiles as listProfilesFn,
  ProfileError,
  ProfileNotFoundError,
  saveProfile as saveProfileFn,
  useProfile as useProfileFn,
} from "#profile/manager.js"
import { printBlank, printLine } from "#utils/output.js"

/**
 * Save the current configuration as a named profile.
 *
 * Prompts the user for a profile name, validates it, and saves the current config into the resolved config directory.
 * Prints a confirmation on success, prints an error message for known profile-related errors, and rethrows unexpected errors.
 *
 * @param options - Command options:
 *   - config: Path or identifier of the configuration to use.
 *   - verbose: Enable verbose output (passed through to underlying operations).
 *   - dryRun: If true, perform a dry run (no-op behaviour handled by underlying save implementation).
 *   - template: Optional template path to include with the saved profile.
 *
 * @throws Rethrows unexpected errors thrown by configuration or profile operations.
 */
export async function menuProfileSave(
  options: Pick<BaseCommandOptions, "config" | "verbose" | "dryRun" | "template">,
): Promise<void> {
  const configPath = resolveConfigPath(options.config)
  const configDir = pathDirname(configPath)
  const config = await loadConfig(configPath)

  const inputName = await text({
    message: "Enter a name for this profile",
    validate: validateProfileName,
  })

  if (isCancel(inputName) || !inputName) {
    printLine(chalk.yellow("Operation cancelled."))
    return
  }

  try {
    await saveProfileFn(configDir, inputName, config, {
      configPath,
      templatePath: options.template,
    })
    printLine(chalk.green(`Profile "${inputName}" saved successfully.`))
  } catch (error) {
    if (error instanceof ProfileError) {
      printLine(chalk.red(error.message))
    } else {
      throw error
    }
  }
}

export async function menuProfileUse(
  options: Pick<BaseCommandOptions, "config" | "verbose">,
): Promise<void> {
  const configPath = resolveConfigPath(options.config)
  const configDir = pathDirname(configPath)
  const profiles = await listProfilesFn(configDir)

  if (profiles.length === 0) {
    printLine(chalk.yellow("No profiles found. Create one first."))
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
    printLine(chalk.yellow("Operation cancelled."))
    return
  }

  try {
    await useProfileFn(configDir, selection)
    printLine(chalk.green(`Now using profile "${selection}".`))
  } catch (error) {
    if (error instanceof ProfileNotFoundError) {
      printLine(chalk.red(error.message))
    } else {
      throw error
    }
  }
}

export async function menuProfileList(
  options: Pick<BaseCommandOptions, "config" | "json">,
): Promise<void> {
  const configPath = resolveConfigPath(options.config)
  const configDir = pathDirname(configPath)
  const profiles = await listProfilesFn(configDir)

  if (profiles.length === 0) {
    printLine(chalk.yellow("No profiles found."))
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
}

/**
 * Delete a non-active profile selected by the user for the resolved configuration directory.
 *
 * Prompts the user to choose from existing profiles (excluding the active one), then deletes the chosen
 * profile unless `options.dryRun` is set. Prints status messages for empty profile lists, cancellation,
 * dry-run output, successful deletion, and profile-not-found errors.
 *
 * @param options - Command options; `config` is used to resolve the config directory, and `dryRun`
 *   causes the command to report the deletion it would perform without making changes.
 */
export async function menuProfileDelete(
  options: Pick<BaseCommandOptions, "config" | "verbose" | "dryRun">,
): Promise<void> {
  const configPath = resolveConfigPath(options.config)
  const configDir = pathDirname(configPath)
  const profiles = await listProfilesFn(configDir)

  if (profiles.length === 0) {
    printLine(chalk.yellow("No profiles found."))
    return
  }

  const selection = await select({
    message: "Select a profile to delete",
    options: profiles
      .filter((p) => !p.isActive)
      .map((p) => ({
        value: p.name,
        label: p.name,
      })),
  })

  if (isCancel(selection)) {
    printLine(chalk.yellow("Operation cancelled."))
    return
  }

  if (options.dryRun) {
    printLine(chalk.yellow(`Dry run: Would delete profile "${selection}"`))
    return
  }

  try {
    await deleteProfileFn(configDir, selection)
    printLine(chalk.green(`Profile "${selection}" deleted.`))
  } catch (error) {
    if (error instanceof ProfileNotFoundError) {
      printLine(chalk.red(error.message))
    } else {
      throw error
    }
  }
}

/**
 * Run the profile template command using the provided CLI options.
 *
 * @param options - CLI options forwarded to the profile template command. Recognized fields include `config`, `verbose`, `dryRun`, and `template`.
 */
export async function menuProfileTemplate(
  options: Pick<BaseCommandOptions, "config" | "verbose" | "dryRun" | "template">,
): Promise<void> {
  await profileTemplateCommand(options)
}

/**
 * Get the directory portion of a configuration path.
 *
 * @param configPath - The file or directory path to derive the directory from
 * @returns The directory portion of `configPath`
 */
function pathDirname(configPath: string): string {
  return path.dirname(configPath)
}

/**
 * Validate a proposed profile name and return an error message when it violates naming rules.
 *
 * Acceptable names are non-empty, at most PROFILE_NAME_MAX_LENGTH characters, and contain only letters,
 * numbers, hyphens, and underscores as defined by PROFILE_NAME_REGEX.
 *
 * @param value - The profile name to validate
 * @returns An error message describing the validation failure, or `undefined` when `value` is valid
 */
function validateProfileName(value: string | undefined): string | undefined {
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
