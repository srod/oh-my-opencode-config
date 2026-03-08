import { confirm, intro, isCancel, outro, select } from "@clack/prompts"
import chalk from "chalk"
import { cleanupOldBackups } from "#backup/manager.js"
import { promptAndCreateBackup } from "#backup/prompt.js"
import type { BaseCommandOptions } from "#cli/types.js"
import { loadConfig } from "#config/loader.js"
import { isQuickSetupPreset, PRESET_CONFIGS, QUICK_SETUP_PRESET_OPTIONS } from "#config/presets.js"
import { resolveConfigPath } from "#config/resolve.js"
import { saveConfig } from "#config/writer.js"
import { formatDiff } from "#diff/formatter.js"
import { generateDiff } from "#diff/generator.js"
import { getFileMtime } from "#utils/fs.js"
import { printLine } from "#utils/output.js"

export async function quickSetupCommand(options: Pick<BaseCommandOptions, "config">) {
  intro(chalk.bold("Quick Setup Presets"))

  const configPath = resolveConfigPath(options.config)
  const initialMtime = await getFileMtime(configPath)
  const currentConfig = await loadConfig(configPath)

  const preset = await select({
    message: "Select a configuration profile:",
    options: QUICK_SETUP_PRESET_OPTIONS,
  })

  if (isCancel(preset)) {
    outro(chalk.yellow("Operation cancelled."))
    return
  }

  if (!isQuickSetupPreset(preset)) {
    outro(chalk.red(`Unknown preset selected: ${preset}`))
    return
  }

  const newConfig = PRESET_CONFIGS[preset]

  const diffEntries = generateDiff(currentConfig, newConfig)

  if (diffEntries.length === 0) {
    outro(chalk.green("✓ Current configuration already matches this preset."))
    return
  }

  printLine(chalk.dim(`\nProposed changes:`))
  printLine(formatDiff(diffEntries))

  const shouldContinue = await confirm({
    message: "Apply these changes?",
  })

  if (isCancel(shouldContinue) || !shouldContinue) {
    outro(chalk.yellow("Operation cancelled."))
    return
  }

  const backupResult = await promptAndCreateBackup(configPath)
  if (backupResult === "cancelled") {
    outro(chalk.yellow("Operation cancelled."))
    return
  }

  await saveConfig({ filePath: configPath, config: newConfig, expectedMtime: initialMtime })
  await cleanupOldBackups(configPath)
  const backupNote = backupResult === "created" ? " Backup created." : ""
  outro(chalk.green(`✓ Configuration updated to ${preset} preset.${backupNote}`))
}
