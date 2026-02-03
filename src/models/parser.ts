import { $ } from "bun"
import {
  AVAILABLE_MODELS_CACHE_PATH,
  AVAILABLE_MODELS_CACHE_TTL_MS,
  MODELS_CACHE_PATH,
  OPENCODE_CONFIG_PATH,
} from "#config/paths.js"
import { CacheCorruptedError, CacheMissingError, PermissionDeniedError } from "#errors/types.js"
import {
  type CustomModel,
  type Model,
  type ModelsCache,
  ModelsCacheSchema,
  OpenCodeConfigSchema,
} from "#types/models.js"
import { isErrnoException } from "#utils/fs.js"

// In-memory cache for model IDs to avoid repeated shell calls
let modelIdsCache: Set<string> | undefined

export async function loadModelsCache(): Promise<ModelsCache> {
  const file = Bun.file(MODELS_CACHE_PATH)

  if (!(await file.exists())) {
    throw new CacheMissingError(MODELS_CACHE_PATH)
  }

  try {
    const content = await file.text()
    const json = JSON.parse(content)
    const result = ModelsCacheSchema.safeParse(json)

    if (!result.success) {
      throw new CacheCorruptedError(result.error.message)
    }

    return result.data
  } catch (error) {
    if (error instanceof CacheCorruptedError) throw error

    if (error instanceof SyntaxError) {
      throw new CacheCorruptedError(`Invalid JSON: ${error.message}`)
    }

    if (isErrnoException(error) && error.code === "EACCES") {
      throw new PermissionDeniedError(MODELS_CACHE_PATH, "read")
    }

    throw error
  }
}

interface AvailableModelsCache {
  modelIds: string[]
  timestamp: number
}

async function loadAvailableModelsFromCache(): Promise<Set<string> | undefined> {
  try {
    const file = Bun.file(AVAILABLE_MODELS_CACHE_PATH)
    if (!(await file.exists())) {
      return undefined
    }

    const content = await file.text()
    const cache: AvailableModelsCache = JSON.parse(content)

    // Check if cache is still fresh
    const age = Date.now() - cache.timestamp
    if (age > AVAILABLE_MODELS_CACHE_TTL_MS) {
      return undefined
    }

    return new Set(cache.modelIds)
  } catch {
    return undefined
  }
}

async function saveAvailableModelsToCache(modelIds: Set<string>): Promise<void> {
  try {
    const cache: AvailableModelsCache = {
      modelIds: [...modelIds],
      timestamp: Date.now(),
    }
    await Bun.write(AVAILABLE_MODELS_CACHE_PATH, JSON.stringify(cache, null, 2))
  } catch {
    // Silently fail - persistent cache is best-effort
  }
}

export async function clearAvailableModelsCache(): Promise<void> {
  try {
    const file = Bun.file(AVAILABLE_MODELS_CACHE_PATH)
    if (await file.exists()) {
      await Bun.file(AVAILABLE_MODELS_CACHE_PATH).delete()
    }
  } catch {
    // Silently fail - cache clearing is best-effort
  }
  modelIdsCache = undefined
}

export interface GetAvailableModelIdsOptions {
  refresh?: boolean
}

export async function getAvailableModelIds(
  options?: GetAvailableModelIdsOptions,
): Promise<Set<string>> {
  const { refresh = false } = options ?? {}

  if (refresh) {
    await clearAvailableModelsCache()
  }

  // Check in-memory cache first
  if (modelIdsCache) {
    return modelIdsCache
  }

  // Try persistent cache (skip if refresh requested)
  if (!refresh) {
    const persistentCache = await loadAvailableModelsFromCache()
    if (persistentCache) {
      modelIdsCache = persistentCache
      return persistentCache
    }
  }

  // Fetch from opencode CLI
  try {
    const result = refresh
      ? await $`opencode models --refresh`.text()
      : await $`opencode models`.text()
    const lines = result.split("\n").filter((line) => line.includes("/"))
    modelIdsCache = new Set(lines.map((line) => line.trim()))

    // Save to persistent cache for next time
    await saveAvailableModelsToCache(modelIdsCache)

    return modelIdsCache
  } catch {
    return new Set()
  }
}

export function clearModelIdsCache(): void {
  modelIdsCache = undefined
}

export async function getAvailableProviders(): Promise<string[]> {
  const modelIds = await getAvailableModelIds()
  const providers = new Set<string>()
  for (const fullId of modelIds) {
    const slashIndex = fullId.indexOf("/")
    if (slashIndex !== -1) {
      providers.add(fullId.slice(0, slashIndex))
    }
  }
  return [...providers].sort()
}

export async function getAvailableModels(
  cache: ModelsCache,
  providerId?: string,
): Promise<Model[]> {
  const availableIds = await getAvailableModelIds()
  if (availableIds.size === 0) {
    return []
  }

  const models: Model[] = []
  for (const fullId of availableIds) {
    const slashIndex = fullId.indexOf("/")
    if (slashIndex === -1) continue

    const provider = fullId.slice(0, slashIndex)
    const modelId = fullId.slice(slashIndex + 1)

    if (providerId && provider !== providerId) continue

    const model = cache[provider]?.models[modelId]
    if (model) {
      models.push(model)
    }
  }

  return models
}

export async function loadCustomModels(configPath?: string): Promise<ModelsCache> {
  const file = Bun.file(configPath ?? OPENCODE_CONFIG_PATH)
  if (!(await file.exists())) {
    return {}
  }

  try {
    const content = await file.text()
    const json = JSON.parse(content)
    const result = OpenCodeConfigSchema.safeParse(json)

    if (!result.success) {
      return {}
    }

    const config = result.data
    const customCache: ModelsCache = {}

    if (config.provider) {
      for (const [providerId, provider] of Object.entries(config.provider)) {
        const models: Record<string, Model> = {}

        for (const [modelId, customModel] of Object.entries(provider.models)) {
          models[modelId] = convertCustomModel(modelId, customModel)
        }

        if (Object.keys(models).length > 0) {
          customCache[providerId] = {
            id: providerId,
            models,
          }
        }
      }
    }

    return customCache
  } catch {
    return {}
  }
}

function convertCustomModel(modelId: string, custom: CustomModel): Model {
  const capabilities: Record<string, boolean> = {
    tool_call: true,
  }

  if (custom.modalities?.input?.includes("image")) {
    capabilities.attachment = true
  }

  if (custom.modalities?.input?.includes("pdf")) {
    capabilities.attachment = true
  }

  if (custom.variants && Object.keys(custom.variants).length > 0) {
    capabilities.reasoning = true
  }

  return {
    id: modelId,
    capabilities,
    name: custom.name,
  }
}

export function mergeModelsCache(cache: ModelsCache, customCache: ModelsCache): ModelsCache {
  const merged: ModelsCache = { ...cache }

  for (const [providerId, customProvider] of Object.entries(customCache)) {
    const existingProvider = merged[providerId]

    if (existingProvider) {
      merged[providerId] = {
        ...existingProvider,
        models: {
          ...existingProvider.models,
          ...customProvider.models,
        },
      }
    } else {
      merged[providerId] = customProvider
    }
  }

  return merged
}

export interface FindModelOptions {
  cache: ModelsCache
  providerId: string
  modelId: string
}

export function findModel(options: FindModelOptions): Model | undefined {
  return options.cache[options.providerId]?.models[options.modelId]
}
