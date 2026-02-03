import { mock } from "bun:test"
import realFs from "node:fs/promises"
import {
  mockCancel,
  mockConfirm,
  mockIntro,
  mockIsCancel,
  mockLog,
  mockOutro,
  mockSelect,
  mockSpinner,
  mockSpinnerInstance,
  mockText,
} from "../../test-utils/clack-mocks.js"
import type { ModelsCache } from "../../types/index.js"
import { AGENT_REQUIREMENTS } from "../../types/requirements.js"

// Capture real fs.stat before mock.module overrides it
export const realStat = realFs.stat.bind(realFs)

export const CANCEL_SYMBOL = Symbol.for("clack:cancel")
export {
  mockCancel,
  mockConfirm,
  mockIntro,
  mockIsCancel,
  mockLog,
  mockOutro,
  mockSelect,
  mockSpinner,
  mockSpinnerInstance,
  mockText,
}

export const mockPrintLine = mock((_text?: string) => {})
export const mockPrintBlank = mock(() => {})

mock.module("../../utils/output.js", () => ({
  printLine: mockPrintLine,
  printBlank: mockPrintBlank,
  printTable: mock(() => {}),
  printError: mock(() => {}),
  printWarning: mock(() => {}),
  printSuccess: mock(() => {}),
  printInfo: mock(() => {}),
  printStep: mock(() => {}),
  printSeparator: mock(() => {}),
}))

export const mockLoadModelsCache = mock(() => Promise.resolve({} as ModelsCache))
export const mockLoadCustomModels = mock(() => Promise.resolve({} as ModelsCache))
export const mockMergeModelsCache = mock((a: ModelsCache, _b: ModelsCache) => a)
export const mockGetAvailableModelIds = mock(() => Promise.resolve(["provider/model-1"]))
export const mockGetAvailableProviders = mock(() => Promise.resolve(["provider"]))
export const mockGetAvailableModels = mock(() =>
  Promise.resolve([{ id: "model-1", name: "Model 1" }]),
)
export const mockFindModel = mock(() => undefined)

mock.module("../../models/parser.js", () => ({
  loadModelsCache: mockLoadModelsCache,
  loadCustomModels: mockLoadCustomModels,
  mergeModelsCache: mockMergeModelsCache,
  getAvailableModelIds: mockGetAvailableModelIds,
  getAvailableProviders: mockGetAvailableProviders,
  getAvailableModels: mockGetAvailableModels,
  findModel: mockFindModel,
}))

export const mockValidateModelForAgent = mock((_model: unknown, _agent: string) => ({
  valid: true,
  missing: [] as string[],
  warnings: [] as string[],
}))

export const mockIsAgentName = mock((name: string) =>
  [
    "oracle",
    "librarian",
    "explore",
    "multimodal-looker",
    "prometheus",
    "metis",
    "sisyphus",
    "atlas",
    "hephaestus",
    "momus",
  ].includes(name),
)

export const mockGetMissingCapabilities = mock(() => [] as string[])
export const mockIsModelSuitable = mock(() => true)

mock.module("../../validation/capabilities.js", () => ({
  validateModelForAgent: mockValidateModelForAgent,
  isAgentName: mockIsAgentName,
  isCapability: mock(() => true),
  hasProperty: mock(() => true),
  AGENT_REQUIREMENTS,
  getMissingCapabilities: mockGetMissingCapabilities,
  isModelSuitable: mockIsModelSuitable,
}))

export const mockLoadConfig = mock((_path?: string) =>
  Promise.resolve({ agents: {}, categories: {} } as Record<string, unknown>),
)
mock.module("../../config/loader.js", () => ({ loadConfig: mockLoadConfig }))

export const mockSaveConfig = mock((_path?: string, _config?: unknown) => Promise.resolve())
mock.module("../../config/writer.js", () => ({ saveConfig: mockSaveConfig }))

export const mockDiscoverConfigPath = mock(() => "/fake/config.json" as string | undefined | null)
mock.module("../../config/discover.js", () => ({ discoverConfigPath: mockDiscoverConfigPath }))

mock.module("../../config/paths.js", () => ({
  MODELS_CACHE_PATH: "/fake/models.json",
  USER_CONFIG_FULL_PATH: "/fake/default-config.json",
}))

export const mockPromptAndCreateBackup = mock(() => Promise.resolve(true))
mock.module("../../backup/prompt.js", () => ({ promptAndCreateBackup: mockPromptAndCreateBackup }))

export const mockCreateBackup = mock(() => Promise.resolve())
export const mockCleanupOldBackups = mock(() => Promise.resolve())
mock.module("../../backup/manager.js", () => ({
  createBackup: mockCreateBackup,
  cleanupOldBackups: mockCleanupOldBackups,
  listBackups: mock(() => Promise.resolve([])),
  restoreBackup: mock(() => Promise.resolve()),
}))

export const mockGenerateDiff = mock(
  () => [{ agent: "oracle", from: "old", to: "new" }] as Record<string, unknown>[],
)
mock.module("../../diff/generator.js", () => ({ generateDiff: mockGenerateDiff }))

export const mockFormatDiff = mock(() => "diff output")
mock.module("../../diff/formatter.js", () => ({ formatDiff: mockFormatDiff }))

export const mockValidateCacheAge = mock(() => Promise.resolve())
mock.module("../../errors/handlers.js", () => ({
  validateCacheAge: mockValidateCacheAge,
  handleError: mock(() => {}),
}))

export const mockStat = mock((_path?: string) =>
  Promise.resolve({ mtime: new Date(1000) } as Record<string, unknown>),
)
mock.module("node:fs/promises", () => ({
  ...realFs,
  default: { ...realFs, stat: mockStat },
  stat: mockStat,
}))

export const DONE_ACTION = "__DONE__"
export const mockSelectAgent = mock(() => Promise.resolve(DONE_ACTION as string | symbol))
mock.module("../../prompts/agents.js", () => ({ selectAgent: mockSelectAgent, DONE_ACTION }))

export const mockSelectModel = mock(() => Promise.resolve({ id: "model-1" }))
mock.module("../../prompts/models.js", () => ({ selectModel: mockSelectModel }))

export const mockSelectVariant = mock(() => Promise.resolve("default"))
mock.module("../../prompts/variants.js", () => ({ selectVariant: mockSelectVariant }))

export const mockSelectProvider = mock(() => Promise.resolve("provider"))
mock.module("../../prompts/provider.js", () => ({ selectProvider: mockSelectProvider }))
