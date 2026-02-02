import { intro, outro } from "@clack/prompts"
import chalk from "chalk"
import { loadConfig } from "../../config/loader.js"
import { resolveConfigPath } from "../../config/resolve.js"
import { loadCustomModels, loadModelsCache, mergeModelsCache } from "../../models/parser.js"
import { colorizeAgent } from "../../types/colors.js"
import { AGENT_REQUIREMENTS } from "../../types/requirements.js"
import { printLine, printSeparator } from "../../utils/output.js"
import { isAgentName, validateModelForAgent } from "../../validation/capabilities.js"
import type { BaseCommandOptions } from "../types.js"

export async function statusCommand(
  options: Pick<BaseCommandOptions, "config" | "opencodeConfig">,
) {
  const configPath = resolveConfigPath(options.config)

  intro(chalk.bold("Configuration Status"))

  printLine(chalk.dim(`\nConfig: ${configPath}\n`))

  const config = await loadConfig(configPath)
  const modelsCache = await loadModelsCache()
  const customModelsCache = await loadCustomModels(options.opencodeConfig)
  const mergedCache = mergeModelsCache(modelsCache, customModelsCache)

  // Agents status
  printLine(chalk.bold("Agents:"))
  printSeparator()

  for (const agentName of Object.keys(AGENT_REQUIREMENTS)) {
    const agentConfig = config.agents?.[agentName]

    if (!agentConfig) {
      printLine(`  ${chalk.red("✗")} ${colorizeAgent(agentName)} ${chalk.gray("— not configured")}`)
      continue
    }

    const parts = agentConfig.model.split("/")
    const provider = parts[0]
    const modelId = parts[1]

    if (!provider || !modelId) {
      printLine(
        `  ${chalk.yellow("?")} ${colorizeAgent(agentName)} ${chalk.gray(`— ${agentConfig.model} (invalid format)`)}`,
      )
      continue
    }

    const model = mergedCache[provider]?.models[modelId]

    if (!model) {
      printLine(
        `  ${chalk.yellow("?")} ${colorizeAgent(agentName)} ${chalk.gray(`— ${agentConfig.model} (unknown model)`)}`,
      )
      continue
    }

    if (!isAgentName(agentName)) {
      printLine(
        `  ${chalk.yellow("?")} ${colorizeAgent(agentName)} ${chalk.gray("— invalid agent name")}`,
      )
      continue
    }

    const validation = validateModelForAgent(model, agentName)

    if (validation.valid) {
      printLine(
        `  ${chalk.green("✓")} ${colorizeAgent(agentName)} ${chalk.gray(`— ${agentConfig.model}${agentConfig.variant ? ` (${agentConfig.variant})` : ""}`)}`,
      )
    } else {
      printLine(
        `  ${chalk.yellow("⚠")} ${colorizeAgent(agentName)} ${chalk.gray(`— ${agentConfig.model}`)}`,
      )
      printLine(`    ${chalk.yellow(`Missing: ${validation.missing.join(", ")}`)}`)
    }
  }

  // Categories status (if any configured)
  if (config.categories && Object.keys(config.categories).length > 0) {
    printLine(chalk.bold("\nCategories:"))
    printSeparator()

    for (const [categoryName, categoryConfig] of Object.entries(config.categories)) {
      if (categoryConfig.model) {
        printLine(
          `  ${chalk.green("✓")} ${chalk.bold(categoryName)} ${chalk.gray(`— ${categoryConfig.model}${categoryConfig.variant ? ` (${categoryConfig.variant})` : ""}`)}`,
        )
      } else {
        printLine(
          `  ${chalk.red("✗")} ${chalk.bold(categoryName)} ${chalk.gray("— not configured")}`,
        )
      }
    }
  }

  // Summary
  const configuredAgents = Object.keys(AGENT_REQUIREMENTS).filter(
    (name) => config.agents?.[name]?.model,
  ).length
  const totalAgents = Object.keys(AGENT_REQUIREMENTS).length
  const configuredCategories = Object.keys(config.categories || {}).length

  printSeparator()
  printLine(`Agents: ${chalk.green(configuredAgents.toString())}/${totalAgents} configured`)
  if (configuredCategories > 0) {
    printLine(`Categories: ${chalk.green(configuredCategories.toString())} configured`)
  }

  outro("")
}
