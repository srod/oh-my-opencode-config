import { confirm, isCancel } from "@clack/prompts"
import chalk from "chalk"
import { printLine } from "#utils/output.js"
import { createBackup } from "./manager.js"

export type BackupPromptResult = "created" | "skipped" | "cancelled"

export async function promptAndCreateBackup(configPath: string): Promise<BackupPromptResult> {
  const file = Bun.file(configPath)
  if (!(await file.exists())) {
    return "skipped"
  }

  const shouldBackup = await confirm({
    message: "Create a backup of current configuration before proceeding?",
    initialValue: true,
  })

  if (isCancel(shouldBackup)) {
    return "cancelled"
  }

  if (!shouldBackup) {
    return "skipped"
  }

  const backupPath = await createBackup(configPath)
  printLine(chalk.dim(`Backup created: ${backupPath}`))
  return "created"
}
