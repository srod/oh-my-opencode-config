import { confirm, isCancel, select, spinner } from "@clack/prompts"
import chalk from "chalk"
import {
  createBackup as createBackupFn,
  listBackups as listBackupsFn,
  restoreBackup as restoreBackupFn,
} from "#backup/manager.js"
import { promptAndCreateBackup } from "#backup/prompt.js"
import type { BaseCommandOptions } from "#cli/types.js"
import { DEFAULT_CONFIG } from "#config/defaults.js"
import { resolveConfigPath } from "#config/resolve.js"
import { saveConfig } from "#config/writer.js"
import { clearAvailableModelsCache, getAvailableModelIds } from "#models/parser.js"
import { printLine } from "#utils/output.js"

export async function menuRefresh(): Promise<void> {
  const s = spinner()
  s.start("Fetching available models from opencode")

  const modelIds = await getAvailableModelIds({ refresh: true })

  if (modelIds.size === 0) {
    s.stop("Failed to fetch models")
    printLine(chalk.yellow("No models found. Make sure opencode is properly configured."))
    return
  }

  const providers = [...new Set([...modelIds].map((id) => id.split("/")[0]))]
  s.stop(`Cached ${modelIds.size} models from ${providers.length} providers`)
  printLine(chalk.green("Model cache refreshed successfully!"))
}

export async function menuBackupRestore(
  options: Pick<BaseCommandOptions, "config" | "dryRun">,
): Promise<void> {
  const configPath = resolveConfigPath(options.config)
  const backups = await listBackupsFn(configPath)

  if (backups.length === 0) {
    printLine(chalk.yellow("No backups found."))
    return
  }

  const selected = await select({
    message: "Select a backup to restore:",
    options: backups.map((b) => ({
      value: b.timestamp,
      label: `${b.timestamp} (${b.created.toLocaleString()})`,
    })),
  })

  if (isCancel(selected)) {
    printLine(chalk.yellow("Operation cancelled."))
    return
  }

  if (options.dryRun) {
    printLine(chalk.yellow(`Dry run: Would restore backup ${selected}`))
    return
  }

  try {
    await restoreBackupFn(configPath, selected)
    printLine(chalk.green(`Successfully restored backup ${selected}`))
  } catch (error) {
    printLine(
      chalk.red(
        `Failed to restore backup: ${error instanceof Error ? error.message : String(error)}`,
      ),
    )
  }
}

export async function menuReset(
  options: Pick<BaseCommandOptions, "config" | "dryRun">,
): Promise<void> {
  const configPath = resolveConfigPath(options.config)

  await promptAndCreateBackup(configPath)

  const shouldReset = await confirm({
    message: chalk.red("Are you sure you want to reset the configuration to defaults?"),
    initialValue: false,
  })

  if (isCancel(shouldReset) || !shouldReset) {
    printLine(chalk.yellow("Reset cancelled."))
    return
  }

  if (options.dryRun) {
    printLine(chalk.yellow("Dry run: No changes applied."))
    return
  }

  const file = Bun.file(configPath)
  if (await file.exists()) {
    await createBackupFn(configPath)
  }
  await saveConfig({ filePath: configPath, config: DEFAULT_CONFIG })
  printLine(chalk.green("Configuration reset to defaults! Backup created."))
}

export async function menuClearCache(): Promise<void> {
  const s = spinner()
  s.start("Clearing available models cache")

  await clearAvailableModelsCache()

  s.stop("Available models cache cleared")
  printLine(chalk.green("Cache cleared successfully!"))
}

/**
 * Display the CLI usage and command reference for the tool.
 *
 * Prints formatted help text describing commands, subcommands, and global options to the console.
 */
export async function showHelpCommand(): Promise<void> {
  printLine("")
  printLine(chalk.bold("oh-my-opencode-config - Interactive CLI for managing model assignments"))
  printLine("")
  printLine(chalk.bold("Usage:"))
  printLine("  oh-my-opencode-config [command] [options]")
  printLine("")
  printLine(chalk.bold("Commands:"))
  printLine("  menu              Interactive main menu (default)")
  printLine("  list              Show current configuration")
  printLine("  status            Show configuration status with visual indicators")
  printLine("  configure         Configure models")
  printLine("    agents          Assign models to agents")
  printLine("    categories      Assign models to categories")
  printLine("    quick-setup     Apply preset configurations (Standard, Economy)")
  printLine("  profile           Manage configuration profiles")
  printLine("    save [name]     Save current config as named profile")
  printLine("    template        Create or update profile template")
  printLine("    use [name]      Switch to named profile")
  printLine("    list            List available profiles")
  printLine("    delete [name]   Delete a profile")
  printLine("  diff              Show differences from defaults")
  printLine("  doctor            Diagnose configuration issues")
  printLine("  history           Show configuration change history")
  printLine("  undo              Undo last configuration change")
  printLine("  export [path]     Export configuration to JSON file")
  printLine("  import [path]     Import configuration from JSON file")
  printLine("  refresh           Refresh models cache from opencode")
  printLine("  clear-cache       Clear models cache")
  printLine("  reset             Reset to defaults")
  printLine("  backup            Manage backups")
  printLine("    list            List available backups")
  printLine("    restore <ts>    Restore specific backup")
  printLine("  help              Show this help message")
  printLine("")
  printLine(chalk.bold("Global Options:"))
  printLine("  --config <path>         Override oh-my-opencode.json path")
  printLine("  --opencode-config <path>  Override opencode.json path")
  printLine("  --template <path>       Override profile template path")
  printLine("  --refresh               Force refresh of model cache")
  printLine("  --json                  Output as JSON")
  printLine("  --verbose               Detailed logging")
  printLine("  --dry-run               Preview without applying")
  printLine("")
}
