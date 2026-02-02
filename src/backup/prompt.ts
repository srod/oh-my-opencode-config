import { confirm, isCancel } from "@clack/prompts"
import chalk from "chalk"
import { printLine } from "../utils/output.js"
import { createBackup } from "./manager.js"

export async function promptAndCreateBackup(configPath: string): Promise<boolean> {
  const file = Bun.file(configPath)
  if (!(await file.exists())) {
    return false
  }

  const shouldBackup = await confirm({
    message: "Create a backup of current configuration before proceeding?",
    initialValue: true,
  })

  if (isCancel(shouldBackup) || !shouldBackup) {
    return false
  }

  const backupPath = await createBackup(configPath)
  printLine(chalk.dim(`Backup created: ${backupPath}`))
  return true
}
