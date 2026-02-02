import path from "node:path"
import { isCancel, select, text } from "@clack/prompts"
import chalk from "chalk"
import { loadConfig } from "../../../config/loader.js"
import { resolveConfigPath } from "../../../config/resolve.js"
import {
  deleteProfile as deleteProfileFn,
  listProfiles as listProfilesFn,
  ProfileError,
  ProfileNotFoundError,
  saveProfile as saveProfileFn,
  useProfile as useProfileFn,
} from "../../../profile/manager.js"
import { printBlank, printLine } from "../../../utils/output.js"
import type { BaseCommandOptions } from "../../types.js"

export async function menuProfileSave(
  options: Pick<BaseCommandOptions, "config" | "verbose" | "dryRun">,
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
    await saveProfileFn(configDir, inputName, config)
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

function pathDirname(configPath: string): string {
  return path.dirname(configPath)
}

function validateProfileName(value: string | undefined): string | undefined {
  if (!value || value.length === 0) {
    return "Profile name is required"
  }
  if (value.length > 50) {
    return "Profile name must be 50 characters or less"
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(value)) {
    return "Profile name must contain only letters, numbers, hyphens, and underscores"
  }
  return undefined
}
