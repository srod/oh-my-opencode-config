import chalk from "chalk"
import { loadConfig } from "#config/loader.js"
import { resolveConfigPath } from "#config/resolve.js"
import { colorizeAgent } from "#types/colors.js"
import { printBlank, printLine, printTable } from "#utils/output.js"
import type { BaseCommandOptions } from "#cli/types.js"

export async function listCommand(options: Pick<BaseCommandOptions, "json" | "config">) {
  const configPath = resolveConfigPath(options.config)
  const config = await loadConfig(configPath)

  if (options.json) {
    printLine(JSON.stringify(config, null, 2))
    return
  }

  printBlank()
  printLine(chalk.bold(`Config source: ${chalk.cyan(configPath)}`))

  if (config.agents && Object.keys(config.agents).length > 0) {
    printBlank()
    printLine(chalk.bold("Agents:"))
    const agentData = Object.entries(config.agents).map(([name, cfg]) => ({
      Agent: colorizeAgent(name),
      Model: cfg.model,
      Variant: cfg.variant || "none",
    }))
    printTable(agentData)
  } else {
    printBlank()
    printLine(chalk.yellow("No agents configured."))
  }

  if (config.categories && Object.keys(config.categories).length > 0) {
    printBlank()
    printLine(chalk.bold("Categories:"))
    const categoryData = Object.entries(config.categories).map(([name, cfg]) => ({
      Category: name,
      Model: cfg.model,
      Variant: cfg.variant || "none",
    }))
    printTable(categoryData)
  } else {
    printBlank()
    printLine(chalk.yellow("No categories configured."))
  }
  printBlank()
}
