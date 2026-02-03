import { cancel, confirm, isCancel, outro } from "@clack/prompts"
import chalk from "chalk"
import { cleanupOldBackups, createBackup } from "#backup/manager.js"
import { promptAndCreateBackup } from "#backup/prompt.js"
import type { BaseCommandOptions } from "#cli/types.js"
import { DEFAULT_CONFIG } from "#config/defaults.js"
import { resolveConfigPath } from "#config/resolve.js"
import { saveConfig } from "#config/writer.js"

export async function resetCommand(options: Pick<BaseCommandOptions, "config" | "dryRun">) {
  const configPath = resolveConfigPath(options.config)

  await promptAndCreateBackup(configPath)

  const shouldReset = await confirm({
    message: chalk.red("Are you sure you want to reset the configuration to defaults?"),
    initialValue: false,
  })

  if (isCancel(shouldReset) || !shouldReset) {
    cancel("Reset cancelled.")
    return
  }

  if (options.dryRun) {
    outro(chalk.yellow("Dry run: No changes applied."))
    return
  }

  try {
    const file = Bun.file(configPath)
    if (await file.exists()) {
      await createBackup(configPath)
    }
    await saveConfig({ filePath: configPath, config: DEFAULT_CONFIG })
    await cleanupOldBackups(configPath)
    outro(chalk.green("Configuration reset to defaults! Backup created."))
  } catch (error) {
    cancel(
      `Failed to reset configuration: ${error instanceof Error ? error.message : String(error)}`,
    )
  }
}
