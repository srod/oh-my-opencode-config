import { beforeEach, describe, expect, test } from "bun:test"
import {
  CANCEL_SYMBOL,
  DONE_ACTION,
  mockCancel,
  mockCleanupOldBackups,
  mockConfirm,
  mockCreateBackup,
  mockFormatDiff,
  mockGenerateDiff,
  mockGetAvailableModels,
  mockGetAvailableProviders,
  mockIntro,
  mockIsCancel,
  mockLoadConfig,
  mockLoadCustomModels,
  mockLoadModelsCache,
  mockMergeModelsCache,
  mockOutro,
  mockPrintLine,
  mockPromptAndCreateBackup,
  mockSaveConfig,
  mockSelectAgent,
  mockSelectModel,
  mockSelectProvider,
  mockSelectVariant,
  mockSpinner,
  mockSpinnerInstance,
  mockStat,
  mockValidateCacheAge,
} from "./test-mocks.js"

const { configureAgentsCommand, configureCategoriesCommand } = await import("./configure.js")

function resetAllMocks() {
  mockIntro.mockClear()
  mockOutro.mockClear()
  mockCancel.mockClear()
  mockConfirm.mockClear()
  mockConfirm.mockImplementation(() => Promise.resolve(false))
  mockIsCancel.mockClear()
  mockIsCancel.mockImplementation((value: unknown) => value === CANCEL_SYMBOL)
  mockSpinnerInstance.start.mockClear()
  mockSpinnerInstance.stop.mockClear()
  mockSpinner.mockClear()
  mockSpinner.mockImplementation(() => mockSpinnerInstance)

  mockLoadConfig.mockClear()
  mockLoadConfig.mockImplementation(() => Promise.resolve({ agents: {}, categories: {} }))
  mockSaveConfig.mockClear()

  mockGetAvailableProviders.mockClear()
  mockGetAvailableProviders.mockImplementation(() => Promise.resolve(["provider"]))
  mockGetAvailableModels.mockClear()
  mockGetAvailableModels.mockImplementation(() =>
    Promise.resolve([{ id: "model-1", name: "Model 1" }]),
  )

  mockPromptAndCreateBackup.mockClear()
  mockCreateBackup.mockClear()
  mockCleanupOldBackups.mockClear()

  mockSelectAgent.mockClear()
  mockSelectAgent.mockImplementation(() => Promise.resolve(DONE_ACTION))
  mockSelectModel.mockClear()
  mockSelectModel.mockImplementation(() => Promise.resolve({ id: "model-1" }))
  mockSelectVariant.mockClear()
  mockSelectVariant.mockImplementation(() => Promise.resolve("default"))
  mockSelectProvider.mockClear()
  mockSelectProvider.mockImplementation(() => Promise.resolve("provider"))

  mockGenerateDiff.mockClear()
  mockGenerateDiff.mockImplementation(() => [{ agent: "oracle", from: "old", to: "new" }])
  mockFormatDiff.mockClear()
  mockPrintLine.mockClear()

  mockValidateCacheAge.mockClear()
  mockStat.mockClear()
  mockStat.mockImplementation(() => Promise.resolve({ mtime: new Date(1000) }))

  // Reset shared mocks to prevent pollution from other test files
  mockLoadModelsCache.mockClear()
  mockLoadModelsCache.mockImplementation(() => Promise.resolve({}))
  mockLoadCustomModels.mockClear()
  mockLoadCustomModels.mockImplementation(() => Promise.resolve({}))
  mockMergeModelsCache.mockClear()
  mockMergeModelsCache.mockImplementation((a) => a)
}

const defaultOptions = { config: "/fake/config.json" }

describe("configureAgentsCommand", () => {
  beforeEach(resetAllMocks)

  test("happy path: select agent → provider → model → variant → save", async () => {
    let agentCallCount = 0
    mockSelectAgent.mockImplementation(() => {
      agentCallCount++
      if (agentCallCount === 1) return Promise.resolve("oracle")
      return Promise.resolve(DONE_ACTION)
    })

    let confirmCount = 0
    mockConfirm.mockImplementation(() => {
      confirmCount++
      if (confirmCount === 1) return Promise.resolve(false)
      if (confirmCount === 2) return Promise.resolve(true)
      return Promise.resolve(false)
    })

    await configureAgentsCommand(defaultOptions)

    expect(mockIntro).toHaveBeenCalled()
    expect(mockPromptAndCreateBackup).toHaveBeenCalled()
    expect(mockSelectAgent).toHaveBeenCalled()
    expect(mockSelectProvider).toHaveBeenCalled()
    expect(mockSelectModel).toHaveBeenCalled()
    expect(mockSelectVariant).toHaveBeenCalled()
    expect(mockSaveConfig).toHaveBeenCalled()
    expect(mockCreateBackup).toHaveBeenCalled()
    expect(mockCleanupOldBackups).toHaveBeenCalled()
    expect(mockOutro).toHaveBeenCalled()
  })

  test("cancel at agent selection", async () => {
    mockSelectAgent.mockImplementation(() => Promise.resolve(CANCEL_SYMBOL as unknown as string))

    await configureAgentsCommand(defaultOptions)

    expect(mockCancel).toHaveBeenCalledWith("Operation cancelled.")
    expect(mockSaveConfig).not.toHaveBeenCalled()
  })

  test("cancel at provider selection", async () => {
    mockSelectAgent.mockImplementation(() => Promise.resolve("oracle"))
    mockSelectProvider.mockImplementation(() => Promise.resolve(CANCEL_SYMBOL as unknown as string))

    await configureAgentsCommand(defaultOptions)

    expect(mockCancel).toHaveBeenCalledWith("Operation cancelled.")
    expect(mockSaveConfig).not.toHaveBeenCalled()
  })

  test("cancel at model selection", async () => {
    mockSelectAgent.mockImplementation(() => Promise.resolve("oracle"))
    mockSelectModel.mockImplementation(() =>
      Promise.resolve(CANCEL_SYMBOL as unknown as { id: string }),
    )

    await configureAgentsCommand(defaultOptions)

    expect(mockCancel).toHaveBeenCalledWith("Operation cancelled.")
    expect(mockSaveConfig).not.toHaveBeenCalled()
  })

  test("cancel at variant selection", async () => {
    mockSelectAgent.mockImplementation(() => Promise.resolve("oracle"))
    mockSelectVariant.mockImplementation(() => Promise.resolve(CANCEL_SYMBOL as unknown as string))

    await configureAgentsCommand(defaultOptions)

    expect(mockCancel).toHaveBeenCalledWith("Operation cancelled.")
    expect(mockSaveConfig).not.toHaveBeenCalled()
  })

  test("DONE_ACTION exits loop with no changes", async () => {
    mockSelectAgent.mockImplementation(() => Promise.resolve(DONE_ACTION))
    mockGenerateDiff.mockImplementation(() => [])

    await configureAgentsCommand(defaultOptions)

    expect(mockOutro).toHaveBeenCalledWith("No changes made.")
    expect(mockSaveConfig).not.toHaveBeenCalled()
  })

  test("multiple agent assignments in one session", async () => {
    let agentCallCount = 0
    mockSelectAgent.mockImplementation(() => {
      agentCallCount++
      if (agentCallCount === 1) return Promise.resolve("oracle")
      if (agentCallCount === 2) return Promise.resolve("librarian")
      return Promise.resolve(DONE_ACTION)
    })

    let confirmCount = 0
    mockConfirm.mockImplementation(() => {
      confirmCount++
      if (confirmCount === 1) return Promise.resolve(true)
      if (confirmCount === 2) return Promise.resolve(false)
      if (confirmCount === 3) return Promise.resolve(true)
      return Promise.resolve(false)
    })

    await configureAgentsCommand(defaultOptions)

    expect(mockSelectAgent).toHaveBeenCalledTimes(2)
    expect(mockSelectProvider).toHaveBeenCalledTimes(2)
    expect(mockSaveConfig).toHaveBeenCalled()
  })

  test("dry-run mode does not save", async () => {
    mockSelectAgent.mockImplementation(() => Promise.resolve("oracle"))
    mockConfirm.mockImplementation(() => Promise.resolve(false))

    await configureAgentsCommand({ ...defaultOptions, dryRun: true })

    expect(mockSaveConfig).not.toHaveBeenCalled()
  })

  test("no changes shows 'No changes made'", async () => {
    mockSelectAgent.mockImplementation(() => Promise.resolve(DONE_ACTION))
    mockGenerateDiff.mockImplementation(() => [])

    await configureAgentsCommand(defaultOptions)

    expect(mockOutro).toHaveBeenCalledWith("No changes made.")
  })

  test("user declines to apply changes", async () => {
    mockSelectAgent.mockImplementation(() => Promise.resolve("oracle"))
    let confirmCount = 0
    mockConfirm.mockImplementation(() => {
      confirmCount++
      if (confirmCount === 1) return Promise.resolve(false)
      if (confirmCount === 2) return Promise.resolve(false)
      return Promise.resolve(false)
    })

    await configureAgentsCommand(defaultOptions)

    expect(mockCancel).toHaveBeenCalledWith("Changes not applied.")
    expect(mockSaveConfig).not.toHaveBeenCalled()
  })

  test("cancel at apply confirmation", async () => {
    mockSelectAgent.mockImplementation(() => Promise.resolve("oracle"))
    let confirmCount = 0
    mockConfirm.mockImplementation(() => {
      confirmCount++
      if (confirmCount === 1) return Promise.resolve(false)
      return Promise.resolve(CANCEL_SYMBOL as unknown as boolean)
    })

    await configureAgentsCommand(defaultOptions)

    expect(mockCancel).toHaveBeenCalledWith("Changes not applied.")
    expect(mockSaveConfig).not.toHaveBeenCalled()
  })

  test("back from provider returns to agent selection", async () => {
    let agentCallCount = 0
    mockSelectAgent.mockImplementation(() => {
      agentCallCount++
      if (agentCallCount === 1) return Promise.resolve("oracle")
      return Promise.resolve(DONE_ACTION)
    })

    mockSelectProvider.mockImplementation(() => Promise.resolve("BACK_ACTION"))
    mockGenerateDiff.mockImplementation(() => [])

    await configureAgentsCommand(defaultOptions)

    expect(mockSelectAgent).toHaveBeenCalledTimes(2)
    expect(mockOutro).toHaveBeenCalledWith("No changes made.")
  })

  test("back from model returns to provider selection", async () => {
    mockSelectAgent.mockImplementation(() => Promise.resolve("oracle"))

    let providerCallCount = 0
    mockSelectProvider.mockImplementation(() => {
      providerCallCount++
      if (providerCallCount <= 2) return Promise.resolve("provider")
      return Promise.resolve(CANCEL_SYMBOL as unknown as string)
    })

    let modelCallCount = 0
    mockSelectModel.mockImplementation(() => {
      modelCallCount++
      if (modelCallCount === 1) return Promise.resolve("BACK_ACTION" as unknown as { id: string })
      return Promise.resolve({ id: "model-1" })
    })

    let confirmCount = 0
    mockConfirm.mockImplementation(() => {
      confirmCount++
      if (confirmCount === 1) return Promise.resolve(false)
      return Promise.resolve(true)
    })

    await configureAgentsCommand(defaultOptions)

    expect(providerCallCount).toBe(2)
  })

  test("no providers available cancels", async () => {
    mockSelectAgent.mockImplementation(() => Promise.resolve("oracle"))
    mockGetAvailableProviders.mockImplementation(() => Promise.resolve([]))

    await configureAgentsCommand(defaultOptions)

    expect(mockCancel).toHaveBeenCalled()
  })

  test("no models available for provider cancels", async () => {
    mockSelectAgent.mockImplementation(() => Promise.resolve("oracle"))
    mockGetAvailableModels.mockImplementation(() => Promise.resolve([]))

    await configureAgentsCommand(defaultOptions)

    expect(mockCancel).toHaveBeenCalled()
  })

  test("passes expectedMtime to saveConfig", async () => {
    mockSelectAgent.mockImplementation(() => Promise.resolve("oracle"))
    let confirmCount = 0
    mockConfirm.mockImplementation(() => {
      confirmCount++
      if (confirmCount === 1) return Promise.resolve(false)
      return Promise.resolve(true)
    })

    await configureAgentsCommand(defaultOptions)

    expect(mockSaveConfig).toHaveBeenCalledTimes(1)
    expect(mockSaveConfig).toHaveBeenCalledWith(expect.objectContaining({ expectedMtime: 1000 }))
  })

  test("loads spinner during model loading", async () => {
    mockSelectAgent.mockImplementation(() => Promise.resolve(DONE_ACTION))
    mockGenerateDiff.mockImplementation(() => [])

    await configureAgentsCommand(defaultOptions)

    expect(mockSpinner).toHaveBeenCalled()
    expect(mockSpinnerInstance.start).toHaveBeenCalledWith("Loading available models")
    expect(mockSpinnerInstance.stop).toHaveBeenCalledWith("Models loaded")
  })
})

describe("configureCategoriesCommand", () => {
  beforeEach(resetAllMocks)

  test("happy path: configure category → provider → model → variant → save", async () => {
    mockLoadConfig.mockImplementation(() =>
      Promise.resolve({
        agents: {},
        categories: { small: { model: "old/model" } },
      }),
    )

    let confirmCount = 0
    mockConfirm.mockImplementation(() => {
      confirmCount++
      if (confirmCount === 1) return Promise.resolve(true)
      if (confirmCount === 2) return Promise.resolve(true)
      return Promise.resolve(false)
    })

    await configureCategoriesCommand(defaultOptions)

    expect(mockIntro).toHaveBeenCalled()
    expect(mockSelectProvider).toHaveBeenCalled()
    expect(mockSelectModel).toHaveBeenCalled()
    expect(mockSelectVariant).toHaveBeenCalled()
    expect(mockSaveConfig).toHaveBeenCalled()
    expect(mockOutro).toHaveBeenCalled()
  })

  test("cancel at first category skips all", async () => {
    mockLoadConfig.mockImplementation(() =>
      Promise.resolve({
        agents: {},
        categories: { small: { model: "old/model" } },
      }),
    )

    mockConfirm.mockImplementation(() => Promise.resolve(CANCEL_SYMBOL as unknown as boolean))

    await configureCategoriesCommand(defaultOptions)

    expect(mockCancel).toHaveBeenCalledWith("Operation cancelled.")
    expect(mockSaveConfig).not.toHaveBeenCalled()
  })

  test("skip category when user declines", async () => {
    mockLoadConfig.mockImplementation(() =>
      Promise.resolve({
        agents: {},
        categories: {
          small: { model: "old/model" },
          medium: { model: "old/model" },
        },
      }),
    )

    let confirmCount = 0
    mockConfirm.mockImplementation(() => {
      confirmCount++
      if (confirmCount === 1) return Promise.resolve(false)
      if (confirmCount === 2) return Promise.resolve(false)
      return Promise.resolve(false)
    })
    mockGenerateDiff.mockImplementation(() => [])

    await configureCategoriesCommand(defaultOptions)

    expect(mockSelectProvider).not.toHaveBeenCalled()
    expect(mockOutro).toHaveBeenCalledWith("No changes made.")
  })

  test("dry-run mode does not save", async () => {
    mockLoadConfig.mockImplementation(() =>
      Promise.resolve({
        agents: {},
        categories: { small: { model: "old/model" } },
      }),
    )

    let confirmCount = 0
    mockConfirm.mockImplementation(() => {
      confirmCount++
      if (confirmCount === 1) return Promise.resolve(true)
      return Promise.resolve(false)
    })

    await configureCategoriesCommand({ ...defaultOptions, dryRun: true })

    expect(mockSaveConfig).not.toHaveBeenCalled()
  })

  test("cancel at provider during category config", async () => {
    mockLoadConfig.mockImplementation(() =>
      Promise.resolve({
        agents: {},
        categories: { small: { model: "old/model" } },
      }),
    )

    mockConfirm.mockImplementation(() => Promise.resolve(true))
    mockSelectProvider.mockImplementation(() => Promise.resolve(CANCEL_SYMBOL as unknown as string))

    await configureCategoriesCommand(defaultOptions)

    expect(mockCancel).toHaveBeenCalledWith("Operation cancelled.")
    expect(mockSaveConfig).not.toHaveBeenCalled()
  })

  test("back from provider at first category cancels", async () => {
    mockLoadConfig.mockImplementation(() =>
      Promise.resolve({
        agents: {},
        categories: { small: { model: "old/model" } },
      }),
    )

    mockConfirm.mockImplementation(() => Promise.resolve(true))
    mockSelectProvider.mockImplementation(() => Promise.resolve("BACK_ACTION"))

    await configureCategoriesCommand(defaultOptions)

    expect(mockCancel).toHaveBeenCalledWith("Operation cancelled.")
  })

  test("no changes shows 'No changes made'", async () => {
    mockLoadConfig.mockImplementation(() =>
      Promise.resolve({
        agents: {},
        categories: { small: { model: "old/model" } },
      }),
    )

    mockConfirm.mockImplementation(() => Promise.resolve(false))
    mockGenerateDiff.mockImplementation(() => [])

    await configureCategoriesCommand(defaultOptions)

    expect(mockOutro).toHaveBeenCalledWith("No changes made.")
  })

  test("uses default categories when config has none", async () => {
    mockLoadConfig.mockImplementation(() => Promise.resolve({ agents: {}, categories: {} }))

    let confirmCount = 0
    mockConfirm.mockImplementation(() => {
      confirmCount++
      return Promise.resolve(false)
    })
    mockGenerateDiff.mockImplementation(() => [])

    await configureCategoriesCommand(defaultOptions)

    expect(confirmCount).toBe(3)
  })

  test("user declines to apply changes", async () => {
    mockLoadConfig.mockImplementation(() =>
      Promise.resolve({
        agents: {},
        categories: { small: { model: "old/model" } },
      }),
    )

    let confirmCount = 0
    mockConfirm.mockImplementation(() => {
      confirmCount++
      if (confirmCount === 1) return Promise.resolve(true)
      if (confirmCount === 2) return Promise.resolve(false)
      return Promise.resolve(false)
    })

    await configureCategoriesCommand(defaultOptions)

    expect(mockCancel).toHaveBeenCalledWith("Changes not applied.")
    expect(mockSaveConfig).not.toHaveBeenCalled()
  })
})
