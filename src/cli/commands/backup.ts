import { cancel, isCancel, outro, select } from "@clack/prompts"
import chalk from "chalk"
import { listBackups, restoreBackup } from "../../backup/manager.js"
import { resolveConfigPath } from "../../config/resolve.js"
import { printBlank, printLine, printTable } from "../../utils/output.js"
import type { BaseCommandOptions } from "../types.js"

export async function backupListCommand(options: Pick<BaseCommandOptions, "config" | "json">) {
  const configPath = resolveConfigPath(options.config)
  const backups = await listBackups(configPath)

  if (options.json) {
    printLine(JSON.stringify(backups, null, 2))
    return
  }

  if (backups.length === 0) {
    printLine(chalk.yellow("No backups found."))
    return
  }

  printBlank()
  printLine(chalk.bold(`Backups for: ${chalk.cyan(configPath)}`))
  const tableData = backups.map((b) => ({
    Timestamp: b.timestamp,
    Created: b.created.toLocaleString(),
  }))
  printTable(tableData)
  printBlank()
}

export async function backupRestoreCommand(
  timestamp: string,
  options: Pick<BaseCommandOptions, "config" | "dryRun">,
) {
  const configPath = resolveConfigPath(options.config)

  if (options.dryRun) {
    outro(chalk.yellow(`Dry run: Would restore backup ${timestamp} to ${configPath}`))
    return
  }

  try {
    await restoreBackup(configPath, timestamp)
    outro(chalk.green(`Successfully restored backup ${timestamp}`))
  } catch (error) {
    cancel(`Failed to restore backup: ${error instanceof Error ? error.message : String(error)}`)
  }
}

export async function backupInteractiveCommand(
  options: Pick<BaseCommandOptions, "config" | "dryRun">,
) {
  const configPath = resolveConfigPath(options.config)
  const backups = await listBackups(configPath)

  if (backups.length === 0) {
    outro(chalk.yellow("No backups found."))
    return
  }

  const selection = await select({
    message: "Select a backup to restore",
    options: backups.map((b) => ({
      value: b.timestamp,
      label: b.timestamp,
      hint: b.created.toLocaleString(),
    })),
  })

  if (isCancel(selection)) {
    cancel("Operation cancelled.")
    return
  }

  if (typeof selection !== "string") {
    cancel("Invalid selection.")
    return
  }

  await backupRestoreCommand(selection, options)
}
