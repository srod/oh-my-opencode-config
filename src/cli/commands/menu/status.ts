import chalk from "chalk"
import { loadConfig } from "../../../config/loader.js"
import { resolveConfigPath } from "../../../config/resolve.js"
import { loadCustomModels, loadModelsCache, mergeModelsCache } from "../../../models/parser.js"
import { colorizeAgent } from "../../../types/colors.js"
import { AGENT_REQUIREMENTS } from "../../../types/requirements.js"
import { printBlank, printLine, printSeparator } from "../../../utils/output.js"
import { isAgentName, validateModelForAgent } from "../../../validation/capabilities.js"
import type { BaseCommandOptions } from "../../types.js"

export async function menuStatus(
  options: Pick<BaseCommandOptions, "config" | "opencodeConfig">,
): Promise<void> {
  const configPath = resolveConfigPath(options.config)
  const config = await loadConfig(configPath)
  const modelsCache = await loadModelsCache()
  const customModelsCache = await loadCustomModels(options.opencodeConfig)
  const mergedCache = mergeModelsCache(modelsCache, customModelsCache)

  printLine(chalk.dim(`\nConfig: ${configPath}\n`))

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
}

export async function menuDoctor(
  options: Pick<BaseCommandOptions, "config" | "opencodeConfig">,
): Promise<void> {
  const configPath = resolveConfigPath(options.config)
  const config = await loadConfig(configPath)
  const modelsCache = await loadModelsCache()
  const customModelsCache = await loadCustomModels(options.opencodeConfig)
  const mergedCache = mergeModelsCache(modelsCache, customModelsCache)

  printBlank()
  printLine(chalk.bold("🔍 Diagnosing configuration..."))
  printBlank()

  const cacheFile = Bun.file(`${process.env.HOME}/.cache/opencode/models.json`)
  const cacheExists = await cacheFile.exists()

  if (cacheExists) {
    printLine(`${chalk.green("✓")} Model cache: Found`)
  } else {
    printLine(`${chalk.red("✗")} Model cache: Missing`)
    printLine(`  ${chalk.gray("→ Suggestion: Run 'oh-my-opencode-config refresh'")}`)
  }

  printLine(`${chalk.green("✓")} Config file: Valid`)
  printLine(chalk.dim(`  (${configPath})`))

  for (const agentName of Object.keys(AGENT_REQUIREMENTS)) {
    const agentConfig = config.agents?.[agentName]

    if (!agentConfig || !agentConfig.model) {
      printLine(
        `${chalk.yellow("⚠")} Agent "${colorizeAgent(agentName)}": ${chalk.yellow("Not configured")}`,
      )
      continue
    }

    const parts = agentConfig.model.split("/")
    const provider = parts[0]
    const modelId = parts[1]

    if (!provider || !modelId) {
      printLine(`${chalk.red("✗")} Agent "${colorizeAgent(agentName)}": Invalid model format`)
      continue
    }

    const model = mergedCache[provider]?.models[modelId]

    if (!model) {
      printLine(
        `${chalk.red("✗")} Agent "${colorizeAgent(agentName)}": Model "${agentConfig.model}" not found`,
      )
      continue
    }

    const validation = validateModelForAgent(model, agentName)

    if (!validation.valid) {
      printLine(
        `${chalk.red("✗")} Agent "${colorizeAgent(agentName)}": Missing ${validation.missing.join(", ")}`,
      )
    } else {
      printLine(`${chalk.green("✓")} Agent "${colorizeAgent(agentName)}": Properly configured`)
    }
  }

  printSeparator()
  printLine(chalk.green("Diagnosis complete."))
}
