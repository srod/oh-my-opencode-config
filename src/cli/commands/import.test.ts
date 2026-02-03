import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test"
import type { Config } from "#types/config.js"
import {
  CANCEL_SYMBOL,
  mockCancel,
  mockConfirm,
  mockDiscoverConfigPath,
  mockFormatDiff,
  mockGenerateDiff,
  mockIntro,
  mockIsCancel,
  mockLoadConfig,
  mockOutro,
  mockPrintLine,
  mockPromptAndCreateBackup,
  mockSaveConfig,
  mockStat,
  mockText,
} from "./test-mocks.js"

const { importCommand } = await import("./import.js")

function setupBunFile(opts: { exists: boolean; content?: string; throwOnText?: Error }) {
  const originalFile = Bun.file
  ;(Bun as Record<string, unknown>).file = mock((_path: string) => ({
    exists: () => Promise.resolve(opts.exists),
    text: () => {
      if (opts.throwOnText) return Promise.reject(opts.throwOnText)
      return Promise.resolve(opts.content ?? "")
    },
  }))
  return () => {
    ;(Bun as Record<string, unknown>).file = originalFile
  }
}

const validConfig: Config = {
  agents: { oracle: { model: "gpt-4", variant: "high" } },
  categories: { quick: { model: "claude-3" } },
}

describe("importCommand", () => {
  let restoreBunFile: (() => void) | undefined

  beforeEach(() => {
    mockIntro.mockClear()
    mockOutro.mockClear()
    mockCancel.mockClear()
    mockText.mockClear()
    mockConfirm.mockClear()
    mockIsCancel.mockClear()
    mockIsCancel.mockImplementation((value: unknown) => value === CANCEL_SYMBOL)
    mockLoadConfig.mockClear()
    mockLoadConfig.mockResolvedValue({ agents: {}, categories: {} })
    mockSaveConfig.mockClear()
    mockSaveConfig.mockResolvedValue(undefined)
    mockDiscoverConfigPath.mockClear()
    mockDiscoverConfigPath.mockReturnValue(undefined)
    mockPromptAndCreateBackup.mockClear()
    mockPromptAndCreateBackup.mockResolvedValue(true)
    mockPrintLine.mockClear()
    mockGenerateDiff.mockClear()
    mockGenerateDiff.mockReturnValue([{ agent: "oracle", from: "old", to: "new" }])
    mockFormatDiff.mockClear()
    mockFormatDiff.mockReturnValue("+ agents.oracle: gpt-4")
    mockStat.mockClear()
    mockStat.mockResolvedValue({ mtime: new Date(1000) })
  })

  afterEach(() => {
    restoreBunFile?.()
    restoreBunFile = undefined
  })

  describe("happy path", () => {
    test("imports valid JSON file with confirmation", async () => {
      restoreBunFile = setupBunFile({
        exists: true,
        content: JSON.stringify(validConfig),
      })
      mockConfirm.mockResolvedValueOnce(true)

      await importCommand("./my-config.json", { config: "/tmp/test-config.json" })

      expect(mockIntro).toHaveBeenCalled()
      expect(mockSaveConfig).toHaveBeenCalledTimes(1)
      expect(mockOutro).toHaveBeenCalled()
    })

    test("prompts for file path when not provided", async () => {
      mockText.mockResolvedValueOnce("./prompted-path.json")
      restoreBunFile = setupBunFile({
        exists: true,
        content: JSON.stringify(validConfig),
      })
      mockConfirm.mockResolvedValueOnce(true)

      await importCommand(undefined, { config: "/tmp/test-config.json" })

      expect(mockText).toHaveBeenCalled()
      expect(mockSaveConfig).toHaveBeenCalledTimes(1)
    })
  })

  describe("file not found", () => {
    test("cancels when import file does not exist", async () => {
      restoreBunFile = setupBunFile({ exists: false })

      await importCommand("./nonexistent.json", { config: "/tmp/test-config.json" })

      expect(mockCancel).toHaveBeenCalledTimes(1)
      expect(mockSaveConfig).not.toHaveBeenCalled()
    })
  })

  describe("invalid JSON", () => {
    test("cancels on JSON syntax error", async () => {
      restoreBunFile = setupBunFile({
        exists: true,
        content: "{ invalid json }}}",
      })

      await importCommand("./bad.json", { config: "/tmp/test-config.json" })

      expect(mockCancel).toHaveBeenCalledTimes(1)
      const cancelArg = mockCancel.mock.calls[0]?.[0]
      expect(String(cancelArg)).toContain("Invalid JSON")
      expect(mockSaveConfig).not.toHaveBeenCalled()
    })

    test("cancels on file read error", async () => {
      restoreBunFile = setupBunFile({
        exists: true,
        throwOnText: new Error("Permission denied"),
      })

      await importCommand("./unreadable.json", { config: "/tmp/test-config.json" })

      expect(mockCancel).toHaveBeenCalledTimes(1)
      const cancelArg = mockCancel.mock.calls[0]?.[0]
      expect(String(cancelArg)).toContain("Failed to read file")
      expect(mockSaveConfig).not.toHaveBeenCalled()
    })
  })

  describe("schema validation failure", () => {
    test("cancels when JSON does not match ConfigSchema", async () => {
      restoreBunFile = setupBunFile({
        exists: true,
        content: JSON.stringify({ agents: "not-an-object" }),
      })

      await importCommand("./bad-schema.json", { config: "/tmp/test-config.json" })

      expect(mockCancel).toHaveBeenCalledTimes(1)
      const cancelArg = mockCancel.mock.calls[0]?.[0]
      expect(String(cancelArg)).toContain("Schema validation failed")
      expect(mockSaveConfig).not.toHaveBeenCalled()
    })
  })

  describe("user cancellation", () => {
    test("cancels when user cancels path prompt", async () => {
      mockText.mockResolvedValueOnce(CANCEL_SYMBOL as unknown as string)

      await importCommand(undefined, { config: "/tmp/test-config.json" })

      expect(mockCancel).toHaveBeenCalledWith("Operation cancelled.")
      expect(mockSaveConfig).not.toHaveBeenCalled()
    })

    test("cancels when user declines apply confirmation", async () => {
      restoreBunFile = setupBunFile({
        exists: true,
        content: JSON.stringify(validConfig),
      })
      mockConfirm.mockResolvedValueOnce(false)

      await importCommand("./my-config.json", { config: "/tmp/test-config.json" })

      expect(mockCancel).toHaveBeenCalled()
      expect(mockSaveConfig).not.toHaveBeenCalled()
    })

    test("cancels when user cancels apply confirmation (symbol)", async () => {
      restoreBunFile = setupBunFile({
        exists: true,
        content: JSON.stringify(validConfig),
      })
      mockConfirm.mockResolvedValueOnce(CANCEL_SYMBOL as unknown as boolean)

      await importCommand("./my-config.json", { config: "/tmp/test-config.json" })

      expect(mockCancel).toHaveBeenCalled()
      expect(mockSaveConfig).not.toHaveBeenCalled()
    })
  })

  describe("dry-run mode", () => {
    test("shows changes but does not save", async () => {
      restoreBunFile = setupBunFile({
        exists: true,
        content: JSON.stringify(validConfig),
      })

      await importCommand("./my-config.json", { config: "/tmp/test-config.json", dryRun: true })

      expect(mockPrintLine).toHaveBeenCalled()
      expect(mockOutro).toHaveBeenCalled()
      const outroArg = String(mockOutro.mock.calls[0]?.[0])
      expect(outroArg).toContain("Dry run")
      expect(mockSaveConfig).not.toHaveBeenCalled()
    })
  })

  describe("no changes detected", () => {
    test("shows up-to-date message when diff is empty", async () => {
      restoreBunFile = setupBunFile({
        exists: true,
        content: JSON.stringify(validConfig),
      })
      mockGenerateDiff.mockReturnValueOnce([])

      await importCommand("./my-config.json", { config: "/tmp/test-config.json" })

      expect(mockOutro).toHaveBeenCalled()
      const outroArg = String(mockOutro.mock.calls[0]?.[0])
      expect(outroArg).toContain("No changes")
      expect(mockSaveConfig).not.toHaveBeenCalled()
    })
  })

  describe("backup handling", () => {
    test("proceeds when backup succeeds", async () => {
      restoreBunFile = setupBunFile({
        exists: true,
        content: JSON.stringify(validConfig),
      })
      mockPromptAndCreateBackup.mockResolvedValueOnce(true)
      mockConfirm.mockResolvedValueOnce(true)

      await importCommand("./my-config.json", { config: "/tmp/test-config.json" })

      expect(mockPromptAndCreateBackup).toHaveBeenCalled()
      expect(mockSaveConfig).toHaveBeenCalled()
    })

    test("asks to continue without backup when backup fails", async () => {
      restoreBunFile = setupBunFile({
        exists: true,
        content: JSON.stringify(validConfig),
      })
      mockPromptAndCreateBackup.mockResolvedValueOnce(false)
      mockConfirm.mockResolvedValueOnce(true).mockResolvedValueOnce(true)

      await importCommand("./my-config.json", { config: "/tmp/test-config.json" })

      expect(mockConfirm).toHaveBeenCalledTimes(2)
      expect(mockSaveConfig).toHaveBeenCalled()
    })

    test("cancels when user declines to continue without backup", async () => {
      restoreBunFile = setupBunFile({
        exists: true,
        content: JSON.stringify(validConfig),
      })
      mockPromptAndCreateBackup.mockResolvedValueOnce(false)
      mockConfirm.mockResolvedValueOnce(false)

      await importCommand("./my-config.json", { config: "/tmp/test-config.json" })

      expect(mockCancel).toHaveBeenCalled()
      expect(mockSaveConfig).not.toHaveBeenCalled()
    })
  })

  describe("config path resolution", () => {
    test("uses options.config when provided", async () => {
      restoreBunFile = setupBunFile({
        exists: true,
        content: JSON.stringify(validConfig),
      })
      mockConfirm.mockResolvedValueOnce(true)

      await importCommand("./my-config.json", { config: "/custom/path.json" })

      expect(mockLoadConfig).toHaveBeenCalledWith("/custom/path.json")
    })

    test("falls back to discoverConfigPath", async () => {
      mockDiscoverConfigPath.mockReturnValueOnce("/discovered/path.json")
      restoreBunFile = setupBunFile({
        exists: true,
        content: JSON.stringify(validConfig),
      })
      mockConfirm.mockResolvedValueOnce(true)

      await importCommand("./my-config.json", {})

      expect(mockLoadConfig).toHaveBeenCalledWith("/discovered/path.json")
    })
  })
})
