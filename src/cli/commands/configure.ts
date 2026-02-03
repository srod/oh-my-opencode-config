import { cancel, confirm, intro, isCancel, outro, spinner } from "@clack/prompts"
import chalk from "chalk"
import { cleanupOldBackups, createBackup } from "../../backup/manager.js"
import { promptAndCreateBackup } from "../../backup/prompt.js"
import { loadConfig } from "../../config/loader.js"
import { MODELS_CACHE_PATH } from "../../config/paths.js"
import { resolveConfigPath } from "../../config/resolve.js"
import { saveConfig } from "../../config/writer.js"
import { formatDiff } from "../../diff/formatter.js"
import { generateDiff } from "../../diff/generator.js"
import { validateCacheAge } from "../../errors/handlers.js"
import {
  getAvailableModelIds,
  getAvailableModels,
  getAvailableProviders,
  loadCustomModels,
  loadModelsCache,
  mergeModelsCache,
} from "../../models/parser.js"
import { DONE_ACTION, selectAgent } from "../../prompts/agents.js"
import { selectModel } from "../../prompts/models.js"
import { selectProvider } from "../../prompts/provider.js"
import { selectVariant } from "../../prompts/variants.js"
import type { Config } from "../../types/config.js"
import { AGENT_REQUIREMENTS } from "../../types/requirements.js"
import { getFileMtime } from "../../utils/fs.js"
import { printLine } from "../../utils/output.js"
import type { AgentName } from "../../validation/capabilities.js"
import { isAgentName } from "../../validation/capabilities.js"
import type { BaseCommandOptions } from "../types.js"

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

async function configureAgentFlow(
  modelsCache: Awaited<ReturnType<typeof loadModelsCache>>,
  agentName: AgentName,
  currentModelId?: string,
  currentVariant?: string,
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

        const modelResult = await selectModel({ models, agentName, currentModelId })
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

    const result = await configureAgentFlow(mergedCache, agent, currentModel, currentVariant)

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

    const result = await configureAgentFlow(mergedCache, "librarian", currentModel, currentVariant)

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
