import { intro, outro } from "@clack/prompts"
import chalk from "chalk"
import { DEFAULT_CONFIG } from "../../config/defaults.js"
import { loadConfig } from "../../config/loader.js"
import { resolveConfigPath } from "../../config/resolve.js"
import { formatDiff, formatDiffJson } from "../../diff/formatter.js"
import { generateDiff } from "../../diff/generator.js"
import { printLine, printSeparator } from "../../utils/output.js"
import type { BaseCommandOptions } from "../types.js"

export async function diffCommand(options: Pick<BaseCommandOptions, "config" | "json">) {
  const configPath = resolveConfigPath(options.config)
  const config = await loadConfig(configPath)

  const diffEntries = generateDiff(DEFAULT_CONFIG, config)

  if (options.json) {
    printLine(formatDiffJson(diffEntries))
    return
  }

  intro(chalk.bold("Configuration Diff"))

  if (diffEntries.length === 0) {
    outro(chalk.green("✓ Current configuration matches defaults."))
    return
  }

  printLine(chalk.dim(`\nComparing to defaults:`))
  printLine(chalk.dim(`Current: ${configPath}\n`))

  const adds = diffEntries.filter((e) => e.type === "add")
  const modifies = diffEntries.filter((e) => e.type === "modify")
  const removes = diffEntries.filter((e) => e.type === "remove")

  printLine(formatDiff(diffEntries))

  printLine("")
  printSeparator()
  printLine(
    `Summary: ${chalk.green(`${adds.length} added`)}${adds.length && modifies.length ? ", " : ""}${chalk.yellow(`${modifies.length} modified`)}${(adds.length || modifies.length) && removes.length ? ", " : ""}${chalk.red(`${removes.length} removed`)}`,
  )

  outro("")
}
