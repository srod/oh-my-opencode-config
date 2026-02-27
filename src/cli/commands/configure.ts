import { cancel, confirm, intro, isCancel, outro, spinner } from "@clack/prompts"
import chalk from "chalk"
import { cleanupOldBackups, createBackup } from "#backup/manager.js"
import { promptAndCreateBackup } from "#backup/prompt.js"
import type { BaseCommandOptions } from "#cli/types.js"
import { loadConfig } from "#config/loader.js"
import { MODELS_CACHE_PATH } from "#config/paths.js"
import { resolveConfigPath } from "#config/resolve.js"
import { saveConfig } from "#config/writer.js"
import { formatDiff } from "#diff/formatter.js"
import { generateDiff } from "#diff/generator.js"
import { validateCacheAge } from "#errors/handlers.js"
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
import type { Config } from "#types/config.js"
import { AGENT_REQUIREMENTS } from "#types/requirements.js"
import { getFileMtime } from "#utils/fs.js"
import { printLine } from "#utils/output.js"
import type { AgentName } from "#validation/capabilities.js"
import { isAgentName } from "#validation/capabilities.js"

interface ConfigureContext {
  configPath: string
  initialMtime: number | undefined
  config: Config
  mergedCache: Awaited<ReturnType<typeof loadModelsCache>>
}

async function loadConfigureContext(
  options: Pick<BaseCommandOptions, "config" | "opencodeConfig" | "refresh">,
  title: string,
): Promise<ConfigureContext> {
  await validateCacheAge(MODELS_CACHE_PATH)
  const configPath = resolveConfigPath(options.config)
  const initialMtime = await getFileMtime(configPath)
  const config = await loadConfig(configPath)
  const modelsCache = await loadModelsCache()
  const customModelsCache = await loadCustomModels(options.opencodeConfig)
  const mergedCache = mergeModelsCache(modelsCache, customModelsCache)

  intro(chalk.bold(title))
  await promptAndCreateBackup(configPath)

  const s = spinner()
  s.start("Loading available models")
  await getAvailableModelIds({ refresh: options.refresh })
  s.stop("Models loaded")

  return { configPath, initialMtime, config, mergedCache }
}

async function saveConfigureResult(
  configPath: string,
  oldConfig: Config,
  newConfig: Config,
  initialMtime: number | undefined,
  dryRun?: boolean,
): Promise<void> {
  const diffEntries = generateDiff(oldConfig, newConfig)
  if (diffEntries.length === 0) {
    outro("No changes made.")
    return
  }

  printLine(`\n${formatDiff(diffEntries)}\n`)

  if (dryRun) {
    outro(chalk.yellow("Dry run: No changes applied."))
    return
  }

  const shouldSave = await confirm({
    message: "Apply these changes?",
  })

  if (isCancel(shouldSave) || !shouldSave) {
    cancel("Changes not applied.")
    return
  }

  await createBackup(configPath)
  await saveConfig({ filePath: configPath, config: newConfig, expectedMtime: initialMtime })
  await cleanupOldBackups(configPath)

  outro(chalk.green("Configuration updated! Backup created."))
}

type Step = "PROVIDER" | "MODEL" | "VARIANT"
type FlowResult =
  | { type: "success"; provider: string; model: { id: string }; variant: string | undefined }
  | { type: "cancel" }
  | { type: "back" }

/**
 * Prompt the user to choose a provider, model, and variant for an agent.
 *
 * This runs an interactive flow: select a provider, then a model (with an optional refresh
 * callback to reload model lists), then a variant. The user may cancel or navigate back at
 * any step.
 *
 * @param modelsCache - Merged models cache used to enumerate available models
 * @param agentName - Agent identifier used to tailor model selection prompts
 * @param currentModelId - Optional model id to preselect in the model chooser
 * @param currentVariant - Optional variant to preselect in the variant chooser
 * @param opencodeConfig - Optional path to the opencode configuration (used when refreshing custom models)
 * @returns On success, an object with `type: "success"` containing `provider`, `model` (with `id`), and `variant`; `type: "cancel"` if the user cancelled; or `type: "back"` if the user requested to go back to the caller.
 */
async function configureAgentFlow(
  modelsCache: Awaited<ReturnType<typeof loadModelsCache>>,
  agentName: AgentName,
  currentModelId?: string,
  currentVariant?: string,
  opencodeConfig?: string,
): Promise<FlowResult> {
  const providers = await getAvailableProviders()
  if (providers.length === 0) {
    cancel("No providers available. Run 'opencode models --refresh' first.")
    return { type: "cancel" }
  }

  let step: Step = "PROVIDER"
  let selectedProvider: string | undefined
  let selectedModel: { id: string } | undefined
  let selectedVariant: string | undefined

  // eslint-disable-next-line no-constant-condition
  while (true) {
    switch (step) {
      case "PROVIDER": {
        const result = await selectProvider(providers, true)
        if (isCancel(result)) return { type: "cancel" }
        if (result === "BACK_ACTION") {
          return { type: "back" }
        }
        selectedProvider = result
        step = "MODEL"
        break
      }

      case "MODEL": {
        if (!selectedProvider) {
          step = "PROVIDER"
          break
        }
        const models = await getAvailableModels(modelsCache, selectedProvider)
        if (models.length === 0) {
          cancel(`No models available for provider ${selectedProvider}.`)
          return { type: "cancel" }
        }

        const modelResult = await selectModel({
          models,
          agentName,
          currentModelId,
          onRefresh: async () => {
            if (!selectedProvider) return []
            await getAvailableModelIds({ refresh: true })
            const refreshedCache = await loadModelsCache()
            const refreshedCustom = await loadCustomModels(opencodeConfig)
            const refreshedMerged = mergeModelsCache(refreshedCache, refreshedCustom)
            return getAvailableModels(refreshedMerged, selectedProvider)
          },
        })
        if (isCancel(modelResult)) return { type: "cancel" }

        if (modelResult === "BACK_ACTION") {
          step = "PROVIDER"
          break
        }

        selectedModel = modelResult
        step = "VARIANT"
        break
      }

      case "VARIANT": {
        const variantResult = await selectVariant(currentVariant)
        if (isCancel(variantResult)) return { type: "cancel" }

        if (variantResult === "BACK_ACTION") {
          step = "MODEL"
          break
        }

        selectedVariant = variantResult
        if (!selectedProvider || !selectedModel) {
          step = "PROVIDER"
          break
        }
        return {
          type: "success",
          provider: selectedProvider,
          model: selectedModel,
          variant: selectedVariant,
        }
      }
    }
  }
}

/**
 * Interactively configure agents' provider, model, and variant selections and persist the changes to the configuration.
 *
 * Loads the existing config and available models, prompts the user to select one or more agents to configure, runs the agent configuration flow for each selected agent, updates the in-memory config with chosen provider/model/variant values, and saves the resulting config (or displays a dry-run summary when `dryRun` is true).
 *
 * @param options - Command options.
 * @param options.config - Path to the configuration file or config identifier used to locate and read the config.
 * @param options.opencodeConfig - Runtime settings required by the agent configuration flow.
 * @param options.refresh - If true, refresh available model data when prompted.
 * @param options.dryRun - If true, do not write changes to disk; show what would be applied instead.
 */
export async function configureAgentsCommand(
  options: Pick<BaseCommandOptions, "config" | "opencodeConfig" | "refresh" | "dryRun">,
) {
  const { configPath, initialMtime, config, mergedCache } = await loadConfigureContext(
    options,
    "Configure Agents",
  )

  const newConfig: Config = JSON.parse(JSON.stringify(config))
  if (!newConfig.agents) newConfig.agents = {}

  const configuredAgents: string[] = []

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const agentResult = await selectAgent(config, configuredAgents)

    if (isCancel(agentResult)) {
      cancel("Operation cancelled.")
      return
    }

    if (agentResult === DONE_ACTION) {
      break
    }

    const agent = agentResult
    if (!isAgentName(agent)) {
      cancel(`Invalid agent: ${agent}`)
      return
    }

    const currentModel = config.agents?.[agent]?.model
    const currentVariant = config.agents?.[agent]?.variant

    const result = await configureAgentFlow(
      mergedCache,
      agent,
      currentModel,
      currentVariant,
      options.opencodeConfig,
    )

    if (result.type === "cancel") {
      cancel("Operation cancelled.")
      return
    }

    if (result.type === "back") {
      continue
    }

    newConfig.agents[agent] = {
      model: `${result.provider}/${result.model.id}`,
      variant: result.variant,
    }

    configuredAgents.push(agent)

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

  await saveConfigureResult(configPath, config, newConfig, initialMtime, options.dryRun)
}

/**
 * Interactive flow to configure model provider, model ID, and variant for each category in the config.
 *
 * Loads the current configuration and available models, prompts the user for each category (with support for skipping,
 * backtracking, and cancellation), applies selected provider/model/variant values to a cloned configuration, and saves
 * the results (or prints a dry-run preview when `dryRun` is enabled).
 *
 * @param options - Command options containing:
 *   - `config`: path or override used to locate the configuration
 *   - `opencodeConfig`: opencode-related settings passed to model selection flows
 *   - `refresh`: whether to refresh available model lists during selection
 *   - `dryRun`: if `true`, do not persist changes; show the planned changes instead
 */
export async function configureCategoriesCommand(
  options: Pick<BaseCommandOptions, "config" | "opencodeConfig" | "refresh" | "dryRun">,
) {
  const { configPath, initialMtime, config, mergedCache } = await loadConfigureContext(
    options,
    "Configure Categories",
  )

  const configCategories = config.categories ?? {}
  const categories = Object.keys(
    Object.keys(configCategories).length > 0
      ? configCategories
      : { small: {}, medium: {}, large: {} },
  )

  const newConfig: Config = JSON.parse(JSON.stringify(config))
  if (!newConfig.categories) newConfig.categories = {}

  let categoryIndex = 0

  // eslint-disable-next-line no-constant-condition
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
        cancel("Operation cancelled.")
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

    const result = await configureAgentFlow(
      mergedCache,
      "librarian",
      currentModel,
      currentVariant,
      options.opencodeConfig,
    )

    if (result.type === "cancel") {
      cancel("Operation cancelled.")
      return
    }

    if (result.type === "back") {
      if (categoryIndex === 0) {
        cancel("Operation cancelled.")
        return
      }
      categoryIndex--
      continue
    }

    if (category) {
      newConfig.categories[category] = {
        model: `${result.provider}/${result.model.id}`,
        variant: result.variant,
      }
    }

    categoryIndex++
  }

  await saveConfigureResult(configPath, config, newConfig, initialMtime, options.dryRun)
}
