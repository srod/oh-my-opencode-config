import { confirm, intro, isCancel, outro } from "@clack/prompts"
import chalk from "chalk"
import { listBackups, restoreBackup } from "../../backup/manager.js"
import { resolveConfigPath } from "../../config/resolve.js"
import { printBlank, printLine } from "../../utils/output.js"
import type { BaseCommandOptions } from "../types.js"

export async function undoCommand(
  options: Pick<BaseCommandOptions, "config" | "dryRun">,
): Promise<void> {
  const configPath = resolveConfigPath(options.config)

  intro(chalk.bold("Undo - Restore Most Recent Backup"))

  const backups = await listBackups(configPath)

  const mostRecentBackup = backups[0]
  if (mostRecentBackup === undefined) {
    outro(chalk.yellow("No backups found. Cannot undo."))
    return
  }

  const timestamp = mostRecentBackup.timestamp

  printLine(chalk.dim(`Config: ${configPath}`))
  printLine(chalk.cyan(`Most recent backup: ${timestamp}`))
  printLine(chalk.dim(`Created: ${mostRecentBackup.created.toLocaleString()}`))
  printBlank()

  if (options.dryRun) {
    outro(chalk.yellow(`Dry run: Would restore backup ${timestamp}`))
    return
  }

  const shouldRestore = await confirm({
    message: `Restore backup ${timestamp}?`,
    initialValue: true,
  })

  if (isCancel(shouldRestore) || !shouldRestore) {
    outro(chalk.yellow("Undo cancelled."))
    return
  }

  await restoreBackup(configPath, timestamp)

  outro(chalk.green(`Successfully restored backup ${timestamp}`))
}
