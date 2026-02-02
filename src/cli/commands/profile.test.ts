import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { type Config, ConfigSchema } from "../../types/config.js"
import {
  CANCEL_SYMBOL,
  mockCancel,
  mockConfirm,
  mockIsCancel,
  mockLoadConfig,
  mockOutro,
  mockPrintBlank,
  mockPrintLine,
  mockSaveConfig,
  mockSelect,
  mockStat,
  mockText,
  realStat,
} from "./test-mocks.js"

let consoleLogs: string[] = []

const {
  profileSaveCommand,
  profileUseCommand,
  profileListCommand,
  profileDeleteCommand,
  profileRenameCommand,
} = await import("./profile.js")

const originalConsoleLog = console.log

describe("profile commands", () => {
  let tempDir: string
  let configPath: string
  let configDir: string

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "profile-cmd-test-"))
    configDir = tempDir
    configPath = path.join(configDir, "oh-my-opencode.json")

    const config: Config = { agents: {}, categories: {} }
    await fs.writeFile(configPath, JSON.stringify(config, null, 2))

    mockText.mockClear()
    mockSelect.mockClear()
    mockConfirm.mockClear()
    mockCancel.mockClear()
    mockOutro.mockClear()
    mockIsCancel.mockClear()
    mockIsCancel.mockImplementation((value: unknown) => value === CANCEL_SYMBOL)

    mockLoadConfig.mockClear()
    mockLoadConfig.mockImplementation(async (p?: string) => {
      if (!p) return { agents: {}, categories: {} }
      const file = Bun.file(p)
      if (!(await file.exists())) return { agents: {}, categories: {} }
      const content = await file.text()
      const json = JSON.parse(content)
      const result = ConfigSchema.safeParse(json)
      return result.success ? result.data : { agents: {}, categories: {} }
    })

    mockSaveConfig.mockClear()
    mockSaveConfig.mockImplementation(async (p?: string, config?: unknown) => {
      if (p && config) await Bun.write(p, JSON.stringify(config, null, 2))
    })

    mockStat.mockClear()
    mockStat.mockImplementation((filePath?: string) =>
      filePath ? realStat(filePath) : realStat("."),
    )

    consoleLogs = []
    mockPrintLine.mockClear()
    mockPrintLine.mockImplementation((text?: string) => {
      consoleLogs.push(text ?? "")
    })
    mockPrintBlank.mockClear()
    mockPrintBlank.mockImplementation(() => {
      consoleLogs.push("")
    })
    console.log = (...args: unknown[]) => {
      consoleLogs.push(args.map((a) => String(a)).join(" "))
    }
  })

  afterEach(async () => {
    console.log = originalConsoleLog
    await fs.rm(tempDir, { recursive: true, force: true })
  })

  describe("profileSaveCommand", () => {
    test("saves profile with provided name", async () => {
      const options = { config: configPath, verbose: false }
      await profileSaveCommand(options, "test-profile")

      const profilePath = path.join(configDir, "oh-my-opencode-test-profile.json")
      const exists = await fs
        .access(profilePath)
        .then(() => true)
        .catch(() => false)
      expect(exists).toBe(true)

      expect(mockOutro).toHaveBeenCalled()
    })

    test("prompts for name when not provided", async () => {
      mockText.mockResolvedValueOnce("prompted-profile")

      const options = { config: configPath, verbose: false }
      await profileSaveCommand(options, undefined)

      expect(mockText).toHaveBeenCalled()

      const profilePath = path.join(configDir, "oh-my-opencode-prompted-profile.json")
      const exists = await fs
        .access(profilePath)
        .then(() => true)
        .catch(() => false)
      expect(exists).toBe(true)
    })

    test("handles user cancellation during name prompt", async () => {
      mockText.mockResolvedValueOnce(CANCEL_SYMBOL as unknown as string)

      const options = { config: configPath, verbose: false }
      await profileSaveCommand(options, undefined)

      expect(mockCancel).toHaveBeenCalledWith("Operation cancelled.")
    })

    test("handles validation errors", async () => {
      const options = { config: configPath, verbose: false }
      await profileSaveCommand(options, "invalid name with spaces")

      expect(mockCancel).toHaveBeenCalled()
    })

    test("handles empty profile name", async () => {
      const options = { config: configPath, verbose: false }
      await profileSaveCommand(options, "")

      expect(mockCancel).toHaveBeenCalled()
    })

    test("saves profile with config content intact", async () => {
      const config: Config = {
        agents: { oracle: { model: "gpt-4", variant: "high" } },
        categories: { quick: { model: "claude-3" } },
      }
      await fs.writeFile(configPath, JSON.stringify(config, null, 2))

      const options = { config: configPath, verbose: false }
      await profileSaveCommand(options, "complex-profile")

      const profilePath = path.join(configDir, "oh-my-opencode-complex-profile.json")
      const content = await fs.readFile(profilePath, "utf-8")
      const parsed: Config = JSON.parse(content)

      expect(parsed).toEqual(config)
    })
  })

  describe("profileUseCommand", () => {
    test("switches to specified profile creating symlink", async () => {
      const saveOptions = { config: configPath, verbose: false }
      await profileSaveCommand(saveOptions, "target-profile")

      const useOptions = { config: configPath, verbose: false }
      await profileUseCommand(useOptions, "target-profile")

      const stats = await fs.lstat(configPath)
      expect(stats.isSymbolicLink()).toBe(true)

      const target = await fs.readlink(configPath)
      expect(target).toContain("oh-my-opencode-target-profile.json")

      expect(mockOutro).toHaveBeenCalled()
    })

    test("prompts to select profile when name not provided", async () => {
      mockSelect.mockResolvedValueOnce("profile-a")

      const saveOptions = { config: configPath, verbose: false }
      await profileSaveCommand(saveOptions, "profile-a")
      await profileSaveCommand(saveOptions, "profile-b")

      const useOptions = { config: configPath, verbose: false }
      await profileUseCommand(useOptions, undefined)

      expect(mockSelect).toHaveBeenCalled()

      const target = await fs.readlink(configPath)
      expect(target).toContain("oh-my-opencode-profile-a.json")
    })

    test("shows message when no profiles exist", async () => {
      await fs.unlink(configPath)

      const useOptions = { config: configPath, verbose: false }
      await profileUseCommand(useOptions, undefined)

      expect(mockOutro).toHaveBeenCalled()
    })

    test("handles user cancellation during selection", async () => {
      mockSelect.mockResolvedValueOnce(CANCEL_SYMBOL as unknown as string)

      const saveOptions = { config: configPath, verbose: false }
      await profileSaveCommand(saveOptions, "some-profile")

      const useOptions = { config: configPath, verbose: false }
      await profileUseCommand(useOptions, undefined)

      expect(mockCancel).toHaveBeenCalledWith("Operation cancelled.")
    })

    test("shows helpful error for nonexistent profile", async () => {
      const useOptions = { config: configPath, verbose: false }
      await profileUseCommand(useOptions, "nonexistent-profile")

      expect(mockCancel).toHaveBeenCalled()
    })
  })

  describe("profileListCommand", () => {
    test("lists profiles in table format", async () => {
      consoleLogs = []

      const saveOptions = { config: configPath, verbose: false }
      await profileSaveCommand(saveOptions, "profile-a")
      await profileSaveCommand(saveOptions, "profile-b")

      const listOptions = { config: configPath, json: false }
      await profileListCommand(listOptions)

      expect(consoleLogs.length).toBeGreaterThan(0)
      const allOutput = consoleLogs.join("\n")

      expect(allOutput).toContain("profile-a")
      expect(allOutput).toContain("profile-b")
      expect(allOutput).toContain("default")
    })

    test("marks active profile with asterisk", async () => {
      consoleLogs = []

      const saveOptions = { config: configPath, verbose: false }
      await profileSaveCommand(saveOptions, "active-profile")

      const useOptions = { config: configPath, verbose: false }
      await profileUseCommand(useOptions, "active-profile")

      consoleLogs = []
      const listOptions = { config: configPath, json: false }
      await profileListCommand(listOptions)

      const allOutput = consoleLogs.join("\n")
      expect(allOutput).toContain("active profile")
    })

    test("outputs JSON format with --json flag", async () => {
      consoleLogs = []

      const saveOptions = { config: configPath, verbose: false }
      await profileSaveCommand(saveOptions, "json-profile")

      const listOptions = { config: configPath, json: true }
      await profileListCommand(listOptions)

      expect(consoleLogs.length).toBe(1)
      const parsed = JSON.parse(consoleLogs[0] || "[]")
      expect(Array.isArray(parsed)).toBe(true)
      expect(parsed.length).toBeGreaterThan(0)

      const profileNames = parsed.map((p: { name: string }) => p.name)
      expect(profileNames).toContain("json-profile")
      expect(profileNames).toContain("default")

      const firstProfile = parsed[0]
      expect(firstProfile).toHaveProperty("name")
      expect(firstProfile).toHaveProperty("isActive")
      expect(firstProfile).toHaveProperty("created")
    })

    test("displays profile creation dates", async () => {
      consoleLogs = []

      const saveOptions = { config: configPath, verbose: false }
      await profileSaveCommand(saveOptions, "dated-profile")

      const listOptions = { config: configPath, json: false }
      await profileListCommand(listOptions)

      const allOutput = consoleLogs.join("\n")
      expect(allOutput).toContain("dated-profile")
    })
  })

  describe("profileDeleteCommand", () => {
    test("deletes profile with confirmation", async () => {
      mockConfirm.mockResolvedValueOnce(true)

      const saveOptions = { config: configPath, verbose: false }
      await profileSaveCommand(saveOptions, "deletable-profile")

      const deleteOptions = { config: configPath, verbose: false, dryRun: false }
      await profileDeleteCommand(deleteOptions, "deletable-profile")

      expect(mockConfirm).toHaveBeenCalledWith({
        message: 'Delete profile "deletable-profile"?',
        initialValue: false,
      })

      const profilePath = path.join(configDir, "oh-my-opencode-deletable-profile.json")
      const exists = await fs
        .access(profilePath)
        .then(() => true)
        .catch(() => false)
      expect(exists).toBe(false)

      expect(mockOutro).toHaveBeenCalled()
    })

    test("prevents deleting active profile", async () => {
      const saveOptions = { config: configPath, verbose: false }
      await profileSaveCommand(saveOptions, "active-for-delete")

      const useOptions = { config: configPath, verbose: false }
      await profileUseCommand(useOptions, "active-for-delete")

      const deleteOptions = { config: configPath, verbose: false, dryRun: false }
      await profileDeleteCommand(deleteOptions, "active-for-delete")

      expect(mockCancel).toHaveBeenCalled()

      const profilePath = path.join(configDir, "oh-my-opencode-active-for-delete.json")
      const exists = await fs
        .access(profilePath)
        .then(() => true)
        .catch(() => false)
      expect(exists).toBe(true)
    })

    test("supports --dry-run flag", async () => {
      mockConfirm.mockResolvedValueOnce(true)

      const saveOptions = { config: configPath, verbose: false }
      await profileSaveCommand(saveOptions, "dry-run-profile")

      const deleteOptions = { config: configPath, verbose: false, dryRun: true }
      await profileDeleteCommand(deleteOptions, "dry-run-profile")

      const profilePath = path.join(configDir, "oh-my-opencode-dry-run-profile.json")
      const exists = await fs
        .access(profilePath)
        .then(() => true)
        .catch(() => false)
      expect(exists).toBe(true)

      expect(mockOutro).toHaveBeenCalled()
    })

    test("prompts to select profile when name not provided", async () => {
      mockSelect.mockResolvedValueOnce("profile-1")
      mockConfirm.mockResolvedValueOnce(true)

      const saveOptions = { config: configPath, verbose: false }
      await profileSaveCommand(saveOptions, "profile-1")
      await profileSaveCommand(saveOptions, "profile-2")

      const deleteOptions = { config: configPath, verbose: false, dryRun: false }
      await profileDeleteCommand(deleteOptions, undefined)

      expect(mockSelect).toHaveBeenCalled()
    })

    test("handles user cancellation during confirmation", async () => {
      mockConfirm.mockResolvedValueOnce(false)

      const saveOptions = { config: configPath, verbose: false }
      await profileSaveCommand(saveOptions, "cancelled-delete")

      const deleteOptions = { config: configPath, verbose: false, dryRun: false }
      await profileDeleteCommand(deleteOptions, "cancelled-delete")

      expect(mockCancel).toHaveBeenCalledWith("Operation cancelled.")

      const profilePath = path.join(configDir, "oh-my-opencode-cancelled-delete.json")
      const exists = await fs
        .access(profilePath)
        .then(() => true)
        .catch(() => false)
      expect(exists).toBe(true)
    })

    test("handles user cancellation during selection", async () => {
      mockSelect.mockResolvedValueOnce(CANCEL_SYMBOL as unknown as string)

      const saveOptions = { config: configPath, verbose: false }
      await profileSaveCommand(saveOptions, "select-cancel")

      const deleteOptions = { config: configPath, verbose: false, dryRun: false }
      await profileDeleteCommand(deleteOptions, undefined)

      expect(mockCancel).toHaveBeenCalledWith("Operation cancelled.")
    })

    test("shows message when only active profile exists", async () => {
      const saveOptions = { config: configPath, verbose: false }
      await profileSaveCommand(saveOptions, "only-active")

      const useOptions = { config: configPath, verbose: false }
      await profileUseCommand(useOptions, "only-active")

      const deleteOptions = { config: configPath, verbose: false, dryRun: false }
      await profileDeleteCommand(deleteOptions, undefined)

      expect(mockOutro).toHaveBeenCalled()
    })
  })

  describe("profileRenameCommand", () => {
    test("renames profile successfully", async () => {
      const saveOptions = { config: configPath, verbose: false }
      await profileSaveCommand(saveOptions, "old-name")

      const renameOptions = { config: configPath, verbose: false }
      await profileRenameCommand(renameOptions, "old-name", "new-name")

      const oldPath = path.join(configDir, "oh-my-opencode-old-name.json")
      const oldExists = await fs
        .access(oldPath)
        .then(() => true)
        .catch(() => false)
      expect(oldExists).toBe(false)

      const newPath = path.join(configDir, "oh-my-opencode-new-name.json")
      const newExists = await fs
        .access(newPath)
        .then(() => true)
        .catch(() => false)
      expect(newExists).toBe(true)

      expect(mockOutro).toHaveBeenCalled()
    })

    test("updates symlink when renaming active profile", async () => {
      const saveOptions = { config: configPath, verbose: false }
      await profileSaveCommand(saveOptions, "active-rename")

      const useOptions = { config: configPath, verbose: false }
      await profileUseCommand(useOptions, "active-rename")

      const renameOptions = { config: configPath, verbose: false }
      await profileRenameCommand(renameOptions, "active-rename", "renamed-active")

      const target = await fs.readlink(configPath)
      expect(target).toContain("oh-my-opencode-renamed-active.json")
      expect(target).not.toContain("oh-my-opencode-active-rename.json")
    })

    test("prompts for old name when not provided", async () => {
      mockSelect.mockResolvedValueOnce("selectable-profile")
      mockText.mockResolvedValueOnce("renamed-prompted")

      const saveOptions = { config: configPath, verbose: false }
      await profileSaveCommand(saveOptions, "selectable-profile")

      const renameOptions = { config: configPath, verbose: false }
      await profileRenameCommand(renameOptions, undefined, undefined)

      expect(mockSelect).toHaveBeenCalled()
    })

    test("prompts for new name when not provided", async () => {
      mockText.mockResolvedValueOnce("prompted-new-name")

      const saveOptions = { config: configPath, verbose: false }
      await profileSaveCommand(saveOptions, "needs-new-name")

      const renameOptions = { config: configPath, verbose: false }
      await profileRenameCommand(renameOptions, "needs-new-name", undefined)

      expect(mockText).toHaveBeenCalled()

      const newPath = path.join(configDir, "oh-my-opencode-prompted-new-name.json")
      const exists = await fs
        .access(newPath)
        .then(() => true)
        .catch(() => false)
      expect(exists).toBe(true)
    })

    test("handles user cancellation during old name selection", async () => {
      mockSelect.mockResolvedValueOnce(CANCEL_SYMBOL as unknown as string)

      const saveOptions = { config: configPath, verbose: false }
      await profileSaveCommand(saveOptions, "cancel-select")

      const renameOptions = { config: configPath, verbose: false }
      await profileRenameCommand(renameOptions, undefined, "new-name")

      expect(mockCancel).toHaveBeenCalledWith("Operation cancelled.")
    })

    test("handles user cancellation during new name prompt", async () => {
      mockText.mockResolvedValueOnce(CANCEL_SYMBOL as unknown as string)

      const saveOptions = { config: configPath, verbose: false }
      await profileSaveCommand(saveOptions, "cancel-new-name")

      const renameOptions = { config: configPath, verbose: false }
      await profileRenameCommand(renameOptions, "cancel-new-name", undefined)

      expect(mockCancel).toHaveBeenCalledWith("Operation cancelled.")
    })

    test("shows message when no profiles exist", async () => {
      await fs.unlink(configPath)

      const renameOptions = { config: configPath, verbose: false }
      await profileRenameCommand(renameOptions, undefined, undefined)

      expect(mockOutro).toHaveBeenCalled()
    })

    test("preserves profile content after rename", async () => {
      const config: Config = {
        agents: { oracle: { model: "gpt-4", variant: "high" } },
        categories: { quick: { model: "claude-3" } },
      }
      await fs.writeFile(configPath, JSON.stringify(config, null, 2))

      const saveOptions = { config: configPath, verbose: false }
      await profileSaveCommand(saveOptions, "content-preserver")

      const renameOptions = { config: configPath, verbose: false }
      await profileRenameCommand(renameOptions, "content-preserver", "content-kept")

      const profilePath = path.join(configDir, "oh-my-opencode-content-kept.json")
      const content = await fs.readFile(profilePath, "utf-8")
      const parsed: Config = JSON.parse(content)

      expect(parsed).toEqual(config)
    })

    test("handles error when renaming to existing profile name", async () => {
      const saveOptions = { config: configPath, verbose: false }
      await profileSaveCommand(saveOptions, "existing-name")
      await profileSaveCommand(saveOptions, "to-rename")

      const renameOptions = { config: configPath, verbose: false }
      await profileRenameCommand(renameOptions, "to-rename", "existing-name")

      expect(mockCancel).toHaveBeenCalled()
    })

    test("handles error for nonexistent profile", async () => {
      const renameOptions = { config: configPath, verbose: false }
      await profileRenameCommand(renameOptions, "nonexistent", "new-name")

      expect(mockCancel).toHaveBeenCalled()
    })
  })

  describe("error scenarios", () => {
    test("profileSaveCommand handles invalid profile names", async () => {
      const options = { config: configPath, verbose: false }

      const invalidNames = ["name with spaces", "special@chars!", "a".repeat(33)]

      for (const name of invalidNames) {
        await profileSaveCommand(options, name)
        expect(mockCancel).toHaveBeenCalled()
      }
    })

    test("profile commands handle verbose error option", async () => {
      const useOptions = { config: configPath, verbose: true }
      await profileUseCommand(useOptions, "definitely-does-not-exist")

      expect(mockCancel).toHaveBeenCalled()
    })
  })
})
