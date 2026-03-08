import { beforeEach, describe, expect, test } from "bun:test"
import {
  CANCEL_SYMBOL,
  mockCleanupOldBackups,
  mockConfirm,
  mockCreateBackup,
  mockFormatDiff,
  mockGenerateDiff,
  mockIntro,
  mockIsCancel,
  mockLoadConfig,
  mockOutro,
  mockPrintLine,
  mockPromptAndCreateBackup,
  mockSaveConfig,
  mockSelect,
  mockStat,
} from "./test-mocks.js"

const { quickSetupCommand } = await import("./quick-setup.js")
const { menuQuickSetup } = await import("./menu/configure.js")

function resetAllMocks() {
  mockIntro.mockClear()
  mockOutro.mockClear()
  mockConfirm.mockClear()
  mockConfirm.mockImplementation(() => Promise.resolve(false))
  mockIsCancel.mockClear()
  mockIsCancel.mockImplementation((value: unknown) => value === CANCEL_SYMBOL)
  mockSelect.mockClear()
  mockSelect.mockImplementation(() => Promise.resolve("standard"))
  mockLoadConfig.mockClear()
  mockLoadConfig.mockImplementation(() => Promise.resolve({ agents: {}, categories: {} }))
  mockSaveConfig.mockClear()
  mockPromptAndCreateBackup.mockClear()
  mockCreateBackup.mockClear()
  mockCleanupOldBackups.mockClear()
  mockGenerateDiff.mockClear()
  mockGenerateDiff.mockImplementation(() => [{ agent: "oracle", from: "old", to: "new" }])
  mockFormatDiff.mockClear()
  mockFormatDiff.mockImplementation(() => "diff output")
  mockPrintLine.mockClear()
  mockStat.mockClear()
  mockStat.mockImplementation(() => Promise.resolve({ mtime: new Date(1000) }))
}

const defaultOptions = { config: "/fake/config.json" }

describe("quickSetupCommand", () => {
  beforeEach(resetAllMocks)

  test("does not prompt for backup when preset selection is cancelled", async () => {
    mockSelect.mockImplementation(() => Promise.resolve(CANCEL_SYMBOL as unknown as string))

    await quickSetupCommand(defaultOptions)

    expect(mockPromptAndCreateBackup).not.toHaveBeenCalled()
    expect(mockCreateBackup).not.toHaveBeenCalled()
    expect(mockSaveConfig).not.toHaveBeenCalled()
    expect(mockOutro).toHaveBeenCalled()
  })

  test("cancels when preset selection does not match a known preset", async () => {
    mockSelect.mockImplementation(() => Promise.resolve("bogus-preset"))

    await quickSetupCommand(defaultOptions)

    expect(mockSaveConfig).not.toHaveBeenCalled()
    expect(mockOutro).toHaveBeenCalled()
  })

  test("does not save when confirm returns the cancel sentinel", async () => {
    mockConfirm.mockImplementation(() => Promise.resolve(CANCEL_SYMBOL as unknown as boolean))

    await quickSetupCommand(defaultOptions)

    expect(mockCreateBackup).not.toHaveBeenCalled()
    expect(mockSaveConfig).not.toHaveBeenCalled()
    expect(mockCleanupOldBackups).not.toHaveBeenCalled()
    expect(mockOutro).toHaveBeenCalled()
  })

  test("does not prompt for backup when the selected preset makes no changes", async () => {
    mockGenerateDiff.mockImplementation(() => [])

    await quickSetupCommand(defaultOptions)

    expect(mockPromptAndCreateBackup).not.toHaveBeenCalled()
    expect(mockCreateBackup).not.toHaveBeenCalled()
    expect(mockSaveConfig).not.toHaveBeenCalled()
    expect(mockCleanupOldBackups).not.toHaveBeenCalled()
    expect(mockOutro).toHaveBeenCalled()
  })

  test("passes expectedMtime when saving a preset", async () => {
    mockConfirm.mockImplementation(() => Promise.resolve(true))

    await quickSetupCommand(defaultOptions)

    expect(mockSaveConfig).toHaveBeenCalledWith({
      filePath: "/fake/config.json",
      config: expect.any(Object),
      expectedMtime: 1000,
    })
  })
})

describe("menuQuickSetup", () => {
  beforeEach(resetAllMocks)

  test("does not prompt for backup when preset selection is cancelled", async () => {
    mockSelect.mockImplementation(() => Promise.resolve(CANCEL_SYMBOL as unknown as string))

    await menuQuickSetup(defaultOptions)

    expect(mockPromptAndCreateBackup).not.toHaveBeenCalled()
    expect(mockCreateBackup).not.toHaveBeenCalled()
    expect(mockSaveConfig).not.toHaveBeenCalled()
    expect(mockPrintLine).toHaveBeenCalled()
  })

  test("cancels when preset selection does not match a known preset", async () => {
    mockSelect.mockImplementation(() => Promise.resolve("bogus-preset"))

    await menuQuickSetup(defaultOptions)

    expect(mockSaveConfig).not.toHaveBeenCalled()
    expect(mockPrintLine).toHaveBeenCalled()
  })

  test("does not save when confirm returns the cancel sentinel", async () => {
    mockConfirm.mockImplementation(() => Promise.resolve(CANCEL_SYMBOL as unknown as boolean))

    await menuQuickSetup(defaultOptions)

    expect(mockCreateBackup).not.toHaveBeenCalled()
    expect(mockSaveConfig).not.toHaveBeenCalled()
    expect(mockPrintLine).toHaveBeenCalled()
  })

  test("does not prompt for backup when the selected preset makes no changes", async () => {
    mockGenerateDiff.mockImplementation(() => [])

    await menuQuickSetup(defaultOptions)

    expect(mockPromptAndCreateBackup).not.toHaveBeenCalled()
    expect(mockCreateBackup).not.toHaveBeenCalled()
    expect(mockSaveConfig).not.toHaveBeenCalled()
    expect(mockPrintLine).toHaveBeenCalled()
  })

  test("passes expectedMtime when saving a preset", async () => {
    mockConfirm.mockImplementation(() => Promise.resolve(true))

    await menuQuickSetup(defaultOptions)

    expect(mockSaveConfig).toHaveBeenCalledWith({
      filePath: "/fake/config.json",
      config: expect.any(Object),
      expectedMtime: 1000,
    })
  })
})
