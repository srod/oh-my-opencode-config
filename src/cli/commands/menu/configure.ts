import { confirm, isCancel, select, spinner } from "@clack/prompts"
import chalk from "chalk"
import { createBackup } from "#backup/manager.js"
import { promptAndCreateBackup } from "#backup/prompt.js"
import type { BaseCommandOptions } from "#cli/types.js"
import { DEFAULT_CONFIG } from "#config/defaults.js"
import { loadConfig } from "#config/loader.js"
import { resolveConfigPath } from "#config/resolve.js"
import { saveConfig } from "#config/writer.js"
import { formatDiff } from "#diff/formatter.js"
import { generateDiff } from "#diff/generator.js"
import {
  getAvailableModelIds,
  getAvailableModels,
  getAvailableProviders,
  loadCustomModels,
  loadModelsCache,
  mergeModelsCache,
} from "#models/parser.js"
import { DONE_ACTION, selectAgent } from "#prompts/agents.js"
import { selectModel } from "#prompts/models.js"
import { selectProvider } from "#prompts/provider.js"
import { selectVariant } from "#prompts/variants.js"
import { AGENT_REQUIREMENTS } from "#types/requirements.js"
import { getFileMtime } from "#utils/fs.js"
import { printLine } from "#utils/output.js"
import { isAgentName } from "#validation/capabilities.js"

/**
 * Interactively configure agents' provider/model/variant assignments in the configuration file.
 *
 * Loads existing configuration and available models (including custom models), prompts the user to
 * select agents and assign a provider, model, and variant for each, shows a formatted diff of
 * proposed changes, and — after confirmation — creates a backup and saves the updated config.
 *
 * @param options - Command options controlling the config file path (`config`), custom models source (`opencodeConfig`),
 *                  whether to refresh remote model data (`refresh`), and whether to perform a dry run without saving (`dryRun`).
 */
export async function menuConfigureAgents(
  options: Pick<BaseCommandOptions, "config" | "opencodeConfig" | "refresh" | "dryRun">,
): Promise<void> {
  const configPath = resolveConfigPath(options.config)
  const initialMtime = await getFileMtime(configPath)
  const config = await loadConfig(configPath)
  const modelsCache = await loadModelsCache()
  const customModelsCache = await loadCustomModels(options.opencodeConfig)
  const mergedCache = mergeModelsCache(modelsCache, customModelsCache)

  await promptAndCreateBackup(configPath)

  const s = spinner()
  s.start("Loading available models")
  await getAvailableModelIds({ refresh: options.refresh })
  s.stop("Models loaded")

  const newConfig: typeof config = JSON.parse(JSON.stringify(config))
  if (!newConfig.agents) newConfig.agents = {}

  const configuredAgents: string[] = []

  while (true) {
    const agentResult = await selectAgent(config, configuredAgents)

    if (isCancel(agentResult)) {
      printLine(chalk.yellow("Operation cancelled."))
      return
    }

    if (agentResult === DONE_ACTION) {
      break
    }

    const agent = agentResult
    if (!isAgentName(agent)) {
      printLine(chalk.red(`Invalid agent: ${agent}`))
      return
    }

    const currentModel = config.agents?.[agent]?.model
    const currentVariant = config.agents?.[agent]?.variant

    const providers = await getAvailableProviders()
    if (providers.length === 0) {
      printLine(chalk.red("No providers available. Run 'opencode models --refresh' first."))
      return
    }

    let selectedProvider: string | undefined
    let selectedModel: { id: string } | undefined
    let selectedVariant: string | undefined
    let step: "PROVIDER" | "MODEL" | "VARIANT" = "PROVIDER"

    while (true) {
      if (step === "PROVIDER") {
        const result = await selectProvider(providers, true)
        if (isCancel(result)) {
          printLine(chalk.yellow("Operation cancelled."))
          return
        }
        if (result === "BACK_ACTION") {
          break
        }
        selectedProvider = result
        step = "MODEL"
      } else if (step === "MODEL") {
        if (!selectedProvider) {
          step = "PROVIDER"
          continue
        }
        const models = await getAvailableModels(mergedCache, selectedProvider)
        if (models.length === 0) {
          printLine(chalk.red(`No models available for provider ${selectedProvider}.`))
          return
        }

        const modelResult = await selectModel({
          models,
          agentName: agent,
          currentModelId: currentModel,
          onRefresh: async () => {
            if (!selectedProvider) return []
            await getAvailableModelIds({ refresh: true })
            const refreshedCache = await loadModelsCache()
            const refreshedCustom = await loadCustomModels(options.opencodeConfig)
            const refreshedMerged = mergeModelsCache(refreshedCache, refreshedCustom)
            return getAvailableModels(refreshedMerged, selectedProvider)
          },
        })
        if (isCancel(modelResult)) {
          printLine(chalk.yellow("Operation cancelled."))
          return
        }
        if (modelResult === "BACK_ACTION") {
          step = "PROVIDER"
          continue
        }
        if (typeof modelResult === "symbol") {
          printLine(chalk.red("No selection found."))
          continue
        }
        selectedModel = modelResult
        step = "VARIANT"
      } else if (step === "VARIANT") {
        const variantResult = await selectVariant(currentVariant)
        if (isCancel(variantResult)) {
          printLine(chalk.yellow("Operation cancelled."))
          return
        }
        if (variantResult === "BACK_ACTION") {
          step = "MODEL"
          continue
        }
        selectedVariant = variantResult
        if (selectedProvider && selectedModel) {
          newConfig.agents[agent] = {
            model: `${selectedProvider}/${selectedModel.id}`,
            variant: selectedVariant,
          }
          configuredAgents.push(agent)
          break
        }
      }
    }

    if (configuredAgents.length >= Object.keys(AGENT_REQUIREMENTS).length) {
      break
    }

    const configureAnother = await confirm({
      message: "Configure another agent?",
      initialValue: false,
    })

    if (isCancel(configureAnother) || !configureAnother) {
      break
    }
  }

  const diffEntries = generateDiff(config, newConfig)
  if (diffEntries.length === 0) {
    printLine(chalk.yellow("No changes made."))
    return
  }

  printLine(`\n${formatDiff(diffEntries)}\n`)

  if (options.dryRun) {
    printLine(chalk.yellow("Dry run: No changes applied."))
    return
  }

  const shouldSave = await confirm({
    message: "Apply these changes?",
  })

  if (isCancel(shouldSave) || !shouldSave) {
    printLine(chalk.yellow("Changes not applied."))
    return
  }

  await createBackup(configPath)
  await saveConfig({ filePath: configPath, config: newConfig, expectedMtime: initialMtime })
  printLine(chalk.green("Configuration updated! Backup created."))
}

/**
 * Interactively configure provider/model/variant mappings for configuration categories.
 *
 * Prompts the user to step through each category, allowing selection of provider, model (with an optional refresh of available models), and variant; computes and displays the resulting diff and, on confirmation, creates a backup and saves the updated configuration file.
 *
 * @param options - Partial command options used by the flow:
 *   - `config`: path or identifier for the config file to load and modify
 *   - `opencodeConfig`: path or data used to load custom model definitions
 *   - `refresh`: when true, forces refreshing available model IDs before prompting
 *   - `dryRun`: when true, shows the proposed changes but does not apply them
 */
export async function menuConfigureCategories(
  options: Pick<BaseCommandOptions, "config" | "opencodeConfig" | "refresh" | "dryRun">,
): Promise<void> {
  const configPath = resolveConfigPath(options.config)
  const initialMtime = await getFileMtime(configPath)
  const config = await loadConfig(configPath)
  const modelsCache = await loadModelsCache()
  const customModelsCache = await loadCustomModels(options.opencodeConfig)
  const mergedCache = mergeModelsCache(modelsCache, customModelsCache)

  await promptAndCreateBackup(configPath)

  const s = spinner()
  s.start("Loading available models")
  await getAvailableModelIds({ refresh: options.refresh })
  s.stop("Models loaded")

  const configCategories = config.categories ?? {}
  const categories = Object.keys(
    Object.keys(configCategories).length > 0
      ? configCategories
      : { small: {}, medium: {}, large: {} },
  )

  const newConfig: typeof config = JSON.parse(JSON.stringify(config))
  if (!newConfig.categories) newConfig.categories = {}

  let categoryIndex = 0

  while (categoryIndex < categories.length) {
    const category = categories[categoryIndex]
    if (!category) {
      categoryIndex++
      continue
    }

    const shouldConfigure = await confirm({
      message: `Configure category ${chalk.cyan(category)}?`,
      initialValue: true,
    })

    if (isCancel(shouldConfigure)) {
      if (categoryIndex === 0) {
        printLine(chalk.yellow("Operation cancelled."))
        return
      }
      categoryIndex--
      continue
    }

    if (!shouldConfigure) {
      categoryIndex++
      continue
    }

    const currentModel = config.categories?.[category]?.model
    const currentVariant = config.categories?.[category]?.variant

    const providers = await getAvailableProviders()
    if (providers.length === 0) {
      printLine(chalk.red("No providers available. Run 'opencode models --refresh' first."))
      return
    }

    let selectedProvider: string | undefined
    let selectedModel: { id: string } | undefined
    let selectedVariant: string | undefined
    let step: "PROVIDER" | "MODEL" | "VARIANT" = "PROVIDER"

    while (true) {
      if (step === "PROVIDER") {
        const result = await selectProvider(providers, true)
        if (isCancel(result)) {
          printLine(chalk.yellow("Operation cancelled."))
          return
        }
        if (result === "BACK_ACTION") {
          categoryIndex--
          break
        }
        selectedProvider = result
        step = "MODEL"
      } else if (step === "MODEL") {
        if (!selectedProvider) {
          step = "PROVIDER"
          continue
        }
        const models = await getAvailableModels(mergedCache, selectedProvider)
        if (models.length === 0) {
          printLine(chalk.red(`No models available for provider ${selectedProvider}.`))
          return
        }

        const modelResult = await selectModel({
          models,
          agentName: "librarian",
          currentModelId: currentModel,
          onRefresh: async () => {
            if (!selectedProvider) return []
            await getAvailableModelIds({ refresh: true })
            const refreshedCache = await loadModelsCache()
            const refreshedCustom = await loadCustomModels(options.opencodeConfig)
            const refreshedMerged = mergeModelsCache(refreshedCache, refreshedCustom)
            return getAvailableModels(refreshedMerged, selectedProvider)
          },
        })
        if (isCancel(modelResult)) {
          printLine(chalk.yellow("Operation cancelled."))
          return
        }
        if (modelResult === "BACK_ACTION") {
          step = "PROVIDER"
          continue
        }
        if (typeof modelResult === "symbol") {
          printLine(chalk.red("No selection found."))
          continue
        }
        selectedModel = modelResult
        step = "VARIANT"
      } else if (step === "VARIANT") {
        const variantResult = await selectVariant(currentVariant)
        if (isCancel(variantResult)) {
          printLine(chalk.yellow("Operation cancelled."))
          return
        }
        if (variantResult === "BACK_ACTION") {
          step = "MODEL"
          continue
        }
        selectedVariant = variantResult
        if (selectedProvider && selectedModel) {
          newConfig.categories[category] = {
            model: `${selectedProvider}/${selectedModel.id}`,
            variant: selectedVariant,
          }
          break
        }
      }
    }

    categoryIndex++
  }

  const diffEntries = generateDiff(config, newConfig)
  if (diffEntries.length === 0) {
    printLine(chalk.yellow("No changes made."))
    return
  }

  printLine(`\n${formatDiff(diffEntries)}\n`)

  if (options.dryRun) {
    printLine(chalk.yellow("Dry run: No changes applied."))
    return
  }

  const shouldSave = await confirm({
    message: "Apply these changes?",
  })

  if (isCancel(shouldSave) || !shouldSave) {
    printLine(chalk.yellow("Changes not applied."))
    return
  }

  await createBackup(configPath)
  await saveConfig({ filePath: configPath, config: newConfig, expectedMtime: initialMtime })
  printLine(chalk.green("Configuration updated! Backup created."))
}

export async function menuQuickSetup(options: Pick<BaseCommandOptions, "config">): Promise<void> {
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
    printLine(chalk.yellow("Operation cancelled."))
    return
  }

  const newConfig = preset === "economy" ? getEconomyConfig() : DEFAULT_CONFIG
  const diffEntries = generateDiff(currentConfig, newConfig)

  if (diffEntries.length === 0) {
    printLine(chalk.green("✓ Current configuration already matches this preset."))
    return
  }

  printLine(chalk.dim(`\nProposed changes:`))
  printLine(formatDiff(diffEntries))

  const shouldContinue = await confirm({
    message: "Apply these changes?",
  })

  if (!shouldContinue) {
    printLine(chalk.yellow("Operation cancelled."))
    return
  }

  await createBackup(configPath)
  await saveConfig({ filePath: configPath, config: newConfig })
  printLine(chalk.green(`✓ Configuration updated to ${preset} preset. Backup created.`))
}

function getEconomyConfig() {
  return {
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
}
