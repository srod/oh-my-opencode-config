import { confirm, intro, outro, select } from "@clack/prompts"
import chalk from "chalk"
import { cleanupOldBackups, createBackup } from "#backup/manager.js"
import { promptAndCreateBackup } from "#backup/prompt.js"
import { DEFAULT_CONFIG } from "#config/defaults.js"
import { loadConfig } from "#config/loader.js"
import { resolveConfigPath } from "#config/resolve.js"
import { saveConfig } from "#config/writer.js"
import { formatDiff } from "#diff/formatter.js"
import { generateDiff } from "#diff/generator.js"
import type { Config } from "#types/config.js"
import { printLine } from "#utils/output.js"
import type { BaseCommandOptions } from "#cli/types.js"

const ECONOMY_CONFIG: Config = {
  agents: {
    sisyphus: { model: "anthropic/claude-haiku-4-5" },
    hephaestus: { model: "anthropic/claude-haiku-4-5" },
    oracle: { model: "openai/gpt-4o" },
    librarian: { model: "openai/gpt-4o-mini" },
    explore: { model: "anthropic/claude-haiku-4-5" },
    "multimodal-looker": { model: "google/gemini-3-flash" },
    prometheus: { model: "anthropic/claude-haiku-4-5" },
    metis: { model: "anthropic/claude-haiku-4-5" },
    momus: { model: "openai/gpt-4o-mini" },
    atlas: { model: "google/gemini-3-flash" },
  },
  categories: {
    "visual-engineering": { model: "google/gemini-3-flash" },
    ultrabrain: { model: "openai/gpt-4o" },
    deep: { model: "openai/gpt-4o" },
    artistry: { model: "google/gemini-3-flash" },
    quick: { model: "anthropic/claude-haiku-4-5" },
    "unspecified-low": { model: "anthropic/claude-haiku-4-5" },
    "unspecified-high": { model: "anthropic/claude-sonnet-4-5" },
    writing: { model: "google/gemini-3-flash" },
  },
}

export async function quickSetupCommand(options: Pick<BaseCommandOptions, "config">) {
  intro(chalk.bold("Quick Setup Presets"))

  const configPath = resolveConfigPath(options.config)

  await promptAndCreateBackup(configPath)

  const currentConfig = await loadConfig(configPath)

  const preset = await select({
    message: "Select a configuration profile:",
    options: [
      {
        value: "standard",
        label: "Standard (Recommended)",
        hint: "Default high-performance models (GPT-5.2, Claude Opus)",
      },
      {
        value: "economy",
        label: "Economy",
        hint: "Cost-effective models (Haiku, Flash, GPT-4o Mini)",
      },
    ],
  })

  if (typeof preset !== "string") {
    outro(chalk.yellow("Operation cancelled."))
    return
  }

  const newConfig = preset === "economy" ? ECONOMY_CONFIG : DEFAULT_CONFIG

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

  if (!shouldContinue) {
    outro(chalk.yellow("Operation cancelled."))
    return
  }

  await createBackup(configPath)
  await saveConfig({ filePath: configPath, config: newConfig })
  await cleanupOldBackups(configPath)
  outro(chalk.green(`✓ Configuration updated to ${preset} preset. Backup created.`))
}
