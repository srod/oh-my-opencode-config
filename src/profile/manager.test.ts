import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { InvalidConfigError } from "#errors/types.js"
import { type Config, ConfigSchema } from "#types/config.js"
import {
  DanglingSymlinkError,
  deleteProfile,
  listProfiles,
  ProfileActiveError,
  ProfileError,
  ProfileExistsError,
  ProfileNameError,
  ProfileNotFoundError,
  renameProfile,
  saveProfile,
  useProfile,
} from "./manager.js"

describe("profile manager", () => {
  let tempDir: string

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "profile-test-"))
  })

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true })
  })

  // ============================================================================
  // saveProfile Tests
  // ============================================================================
  describe("saveProfile", () => {
    test("creates file with valid name", async () => {
      const config: Config = { agents: {}, categories: {} }
      await saveProfile(tempDir, "my-profile", config)

      const profilePath = path.join(tempDir, "oh-my-opencode-my-profile.json")
      const content = await fs.readFile(profilePath, "utf-8")
      const parsed = JSON.parse(content)

      expect(parsed).toEqual(config)
    })

    test("auto-creates default profile on first save", async () => {
      const config: Config = { agents: { oracle: { model: "gpt-4" } }, categories: {} }
      await saveProfile(tempDir, "production", config)

      const defaultPath = path.join(tempDir, "oh-my-opencode-default.json")
      const defaultExists = await fs
        .access(defaultPath)
        .then(() => true)
        .catch(() => false)

      expect(defaultExists).toBe(true)

      const defaultContent = await fs.readFile(defaultPath, "utf-8")
      const parsed = JSON.parse(defaultContent)
      expect(parsed).toEqual(config)
    })

    test("auto-creates default from current config when config file exists", async () => {
      const currentConfig: Config = { agents: { oracle: { model: "claude-4" } }, categories: {} }
      const configPath = path.join(tempDir, "oh-my-opencode.json")
      await fs.writeFile(configPath, JSON.stringify(currentConfig, null, 2))

      const newConfig: Config = { agents: { oracle: { model: "gpt-5" } }, categories: {} }
      await saveProfile(tempDir, "production", newConfig)

      const defaultPath = path.join(tempDir, "oh-my-opencode-default.json")
      const defaultContent = await fs.readFile(defaultPath, "utf-8")
      const parsed = JSON.parse(defaultContent)
      expect(parsed).toEqual(currentConfig)
    })

    test("auto-creates default only when saving non-default profile first", async () => {
      const config: Config = { agents: {}, categories: {} }
      await saveProfile(tempDir, "production", config)

      const profiles = await fs.readdir(tempDir)
      const profileFiles = profiles.filter((f) => f.startsWith("oh-my-opencode-"))
      expect(profileFiles).toHaveLength(2)
      expect(profileFiles).toContain("oh-my-opencode-default.json")
      expect(profileFiles).toContain("oh-my-opencode-production.json")
    })

    test("rejects empty name", async () => {
      const config: Config = { agents: {}, categories: {} }
      await expect(saveProfile(tempDir, "", config)).rejects.toThrow(ProfileNameError)
    })

    test("rejects name too long (>32 chars)", async () => {
      const config: Config = { agents: {}, categories: {} }
      const longName = "a".repeat(33)
      await expect(saveProfile(tempDir, longName, config)).rejects.toThrow(ProfileNameError)
    })

    test("rejects names with spaces", async () => {
      const config: Config = { agents: {}, categories: {} }
      await expect(saveProfile(tempDir, "my profile", config)).rejects.toThrow(ProfileNameError)
    })

    test("rejects names with special characters", async () => {
      const config: Config = { agents: {}, categories: {} }
      await expect(saveProfile(tempDir, "my@profile!", config)).rejects.toThrow(ProfileNameError)
    })

    test("rejects reserved names", async () => {
      const config: Config = { agents: {}, categories: {} }
      const reservedNames = ["default", "backup", "temp", "current", "oh-my-opencode"]

      for (const name of reservedNames) {
        await expect(saveProfile(tempDir, name, config)).rejects.toThrow(ProfileNameError)
      }
    })

    test("rejects invalid config schema", async () => {
      const invalidConfig = { agents: "not-an-object" } as unknown as Config
      await expect(saveProfile(tempDir, "test", invalidConfig)).rejects.toThrow(InvalidConfigError)
    })

    test("rejects config with wrong agent model type", async () => {
      const invalidConfig = {
        agents: { oracle: { model: 123, variant: "high" } },
        categories: {},
      } as unknown as Config
      await expect(saveProfile(tempDir, "test", invalidConfig)).rejects.toThrow(InvalidConfigError)
    })

    test("accepts valid names with hyphens and underscores", async () => {
      const config: Config = { agents: {}, categories: {} }
      const validNames = ["my-profile", "my_profile", "My-Profile_123", "a", "a".repeat(32)]

      for (const name of validNames) {
        await saveProfile(tempDir, name, config)
        const profilePath = path.join(tempDir, `oh-my-opencode-${name}.json`)
        const exists = await fs
          .access(profilePath)
          .then(() => true)
          .catch(() => false)
        expect(exists).toBe(true)
      }
    })

    test("overwrites existing profile file", async () => {
      const config1: Config = { agents: { oracle: { model: "gpt-4" } }, categories: {} }
      await saveProfile(tempDir, "test", config1)

      const config2: Config = { agents: { oracle: { model: "claude-4" } }, categories: {} }
      await saveProfile(tempDir, "test", config2)

      const profilePath = path.join(tempDir, "oh-my-opencode-test.json")
      const content = await fs.readFile(profilePath, "utf-8")
      const parsed = JSON.parse(content)

      expect(parsed.agents?.oracle?.model).toBe("claude-4")
    })

    test("applies template and deep merges with config overrides", async () => {
      const templatePath = path.join(tempDir, "custom-template.json")
      const template = {
        $schema:
          "https://raw.githubusercontent.com/code-yeongyu/oh-my-opencode/master/assets/oh-my-opencode.schema.json",
        google_auth: false,
        sisyphus_agent: {
          default_builder_enabled: true,
          replace_plan: true,
        },
        disabled_hooks: ["template-hook"],
      }
      await fs.writeFile(templatePath, JSON.stringify(template, null, 2))

      const config = ConfigSchema.parse({
        agents: { oracle: { model: "gpt-5" } },
        categories: {},
        sisyphus_agent: {
          replace_plan: false,
        },
        disabled_hooks: ["comment-checker"],
      })

      await saveProfile(tempDir, "templated", config, { templatePath })

      const profilePath = path.join(tempDir, "oh-my-opencode-templated.json")
      const content = await fs.readFile(profilePath, "utf-8")
      const parsed = JSON.parse(content)

      expect(parsed.$schema).toBe(template.$schema)
      expect(parsed.google_auth).toBe(false)
      expect(parsed.sisyphus_agent.default_builder_enabled).toBe(true)
      expect(parsed.sisyphus_agent.replace_plan).toBe(false)
      expect(parsed.disabled_hooks).toEqual(["comment-checker"])
      expect(parsed.agents.oracle.model).toBe("gpt-5")
    })

    test("falls back to default template path when explicit template is missing", async () => {
      const configPath = path.join(tempDir, "oh-my-opencode.json")
      const fallbackTemplatePath = path.join(tempDir, "oh-my-opencode.template.json")
      await fs.writeFile(fallbackTemplatePath, JSON.stringify({ google_auth: false }, null, 2))

      const config = ConfigSchema.parse({ agents: {}, categories: {} })
      await saveProfile(tempDir, "fallback", config, {
        configPath,
        templatePath: path.join(tempDir, "does-not-exist.json"),
      })

      const profilePath = path.join(tempDir, "oh-my-opencode-fallback.json")
      const parsed = JSON.parse(await fs.readFile(profilePath, "utf-8"))

      expect(parsed.google_auth).toBe(false)
    })
  })

  // ============================================================================
  // useProfile Tests
  // ============================================================================
  describe("useProfile", () => {
    test("creates symlink correctly", async () => {
      const config: Config = { agents: {}, categories: {} }
      await saveProfile(tempDir, "test", config)

      await useProfile(tempDir, "test")

      const configPath = path.join(tempDir, "oh-my-opencode.json")
      const stats = await fs.lstat(configPath)
      expect(stats.isSymbolicLink()).toBe(true)

      const target = await fs.readlink(configPath)
      expect(target).toContain("oh-my-opencode-test.json")
    })

    test("throws ProfileNotFoundError for nonexistent profile", async () => {
      await expect(useProfile(tempDir, "nonexistent")).rejects.toThrow(ProfileNotFoundError)
    })

    test("throws ProfileNameError for invalid name", async () => {
      await expect(useProfile(tempDir, "invalid name")).rejects.toThrow(ProfileNameError)
    })

    test("throws DanglingSymlinkError when active profile is deleted", async () => {
      const config: Config = { agents: {}, categories: {} }
      await saveProfile(tempDir, "test", config)
      await useProfile(tempDir, "test")

      const profilePath = path.join(tempDir, "oh-my-opencode-test.json")
      await fs.unlink(profilePath)

      await expect(listProfiles(tempDir)).rejects.toThrow(DanglingSymlinkError)
    })

    test("allows switching when no unsaved changes", async () => {
      const config: Config = { agents: {}, categories: {} }
      await saveProfile(tempDir, "profile1", config)
      await saveProfile(tempDir, "profile2", config)
      await useProfile(tempDir, "profile1")

      // Switch to profile2 should succeed
      await expect(useProfile(tempDir, "profile2")).resolves.toBeUndefined()

      const configPath = path.join(tempDir, "oh-my-opencode.json")
      const target = await fs.readlink(configPath)
      expect(target).toContain("oh-my-opencode-profile2.json")
    })

    test("handles case where config file is not a symlink", async () => {
      const config: Config = { agents: {}, categories: {} }
      await saveProfile(tempDir, "test", config)

      // Create a regular file instead of symlink
      const configPath = path.join(tempDir, "oh-my-opencode.json")
      await fs.writeFile(configPath, JSON.stringify(config, null, 2))

      // Should succeed without unsaved changes check
      await expect(useProfile(tempDir, "test")).resolves.toBeUndefined()
    })

    test("updates symlink atomically when switching profiles", async () => {
      const config: Config = { agents: {}, categories: {} }
      await saveProfile(tempDir, "profile1", config)
      await saveProfile(tempDir, "profile2", config)
      await useProfile(tempDir, "profile1")

      await useProfile(tempDir, "profile2")

      const configPath = path.join(tempDir, "oh-my-opencode.json")
      const stats = await fs.lstat(configPath)
      expect(stats.isSymbolicLink()).toBe(true)

      const target = await fs.readlink(configPath)
      expect(target).toContain("oh-my-opencode-profile2.json")
    })
  })

  // ============================================================================
  // listProfiles Tests
  // ============================================================================
  describe("listProfiles", () => {
    test("lists all profiles", async () => {
      const config: Config = { agents: {}, categories: {} }
      await saveProfile(tempDir, "profile1", config)
      await saveProfile(tempDir, "profile2", config)
      await saveProfile(tempDir, "profile3", config)

      const profiles = await listProfiles(tempDir)

      expect(profiles).toHaveLength(4)
      const names = profiles.map((p) => p.name)
      expect(names).toContain("profile1")
      expect(names).toContain("profile2")
      expect(names).toContain("profile3")
      expect(names).toContain("default")
    })

    test("correctly identifies active profile", async () => {
      const config: Config = { agents: {}, categories: {} }
      await saveProfile(tempDir, "profile1", config)
      await saveProfile(tempDir, "profile2", config)
      await useProfile(tempDir, "profile2")

      const profiles = await listProfiles(tempDir)

      const activeProfile = profiles.find((p) => p.isActive)
      expect(activeProfile?.name).toBe("profile2")

      const inactiveProfiles = profiles.filter((p) => !p.isActive)
      expect(inactiveProfiles).toHaveLength(2)
      const inactiveNames = inactiveProfiles.map((p) => p.name)
      expect(inactiveNames).toContain("profile1")
      expect(inactiveNames).toContain("default")
    })

    test("returns empty array for empty directory", async () => {
      const profiles = await listProfiles(tempDir)
      expect(profiles).toEqual([])
    })

    test("ignores non-profile files", async () => {
      const config: Config = { agents: {}, categories: {} }
      await saveProfile(tempDir, "valid-profile", config)

      await fs.writeFile(path.join(tempDir, "random-file.txt"), "content")
      await fs.writeFile(path.join(tempDir, "oh-my-opencode.json"), "{}")
      await fs.writeFile(path.join(tempDir, "other-config.json"), "{}")

      const profiles = await listProfiles(tempDir)
      expect(profiles).toHaveLength(2)
      const names = profiles.map((p) => p.name)
      expect(names).toContain("valid-profile")
      expect(names).toContain("default")
    })

    test("throws DanglingSymlinkError when symlink points to nonexistent profile", async () => {
      const config: Config = { agents: {}, categories: {} }
      await saveProfile(tempDir, "test", config)
      await useProfile(tempDir, "test")

      const profilePath = path.join(tempDir, "oh-my-opencode-test.json")
      await fs.unlink(profilePath)

      await expect(listProfiles(tempDir)).rejects.toThrow(DanglingSymlinkError)
    })

    test("returns null active profile when config is not a symlink", async () => {
      const config: Config = { agents: {}, categories: {} }
      await saveProfile(tempDir, "test", config)

      const configPath = path.join(tempDir, "oh-my-opencode.json")
      await fs.writeFile(configPath, JSON.stringify(config, null, 2))

      const profiles = await listProfiles(tempDir)
      expect(profiles).toHaveLength(2)
      const inactiveProfiles = profiles.filter((p) => !p.isActive)
      expect(inactiveProfiles).toHaveLength(2)
    })

    test("includes created date for profiles", async () => {
      const config: Config = { agents: {}, categories: {} }
      await saveProfile(tempDir, "test", config)

      const profiles = await listProfiles(tempDir)
      const testProfile = profiles.find((p) => p.name === "test")
      expect(testProfile?.created).toBeInstanceOf(Date)
    })

    test("sorts profiles by creation date (oldest first)", async () => {
      const config: Config = { agents: {}, categories: {} }

      await saveProfile(tempDir, "oldest", config)
      await new Promise((resolve) => setTimeout(resolve, 50))
      await saveProfile(tempDir, "middle", config)
      await new Promise((resolve) => setTimeout(resolve, 50))
      await saveProfile(tempDir, "newest", config)

      const profiles = await listProfiles(tempDir)
      const names = profiles.map((p) => p.name)
      expect(names).toContain("oldest")
      expect(names).toContain("middle")
      expect(names).toContain("newest")
      expect(names).toContain("default")

      const oldestIndex = names.indexOf("oldest")
      const middleIndex = names.indexOf("middle")
      const newestIndex = names.indexOf("newest")

      expect(oldestIndex).toBeLessThan(middleIndex)
      expect(middleIndex).toBeLessThan(newestIndex)
    })
  })

  // ============================================================================
  // deleteProfile Tests
  // ============================================================================
  describe("deleteProfile", () => {
    test("deletes inactive profile", async () => {
      const config: Config = { agents: {}, categories: {} }
      await saveProfile(tempDir, "test", config)

      await deleteProfile(tempDir, "test")

      const profilePath = path.join(tempDir, "oh-my-opencode-test.json")
      const exists = await fs
        .access(profilePath)
        .then(() => true)
        .catch(() => false)
      expect(exists).toBe(false)
    })

    test("throws ProfileNotFoundError for nonexistent profile", async () => {
      await expect(deleteProfile(tempDir, "nonexistent")).rejects.toThrow(ProfileNotFoundError)
    })

    test("throws ProfileActiveError when deleting active profile", async () => {
      const config: Config = { agents: {}, categories: {} }
      await saveProfile(tempDir, "active", config)
      await useProfile(tempDir, "active")

      await expect(deleteProfile(tempDir, "active")).rejects.toThrow(ProfileActiveError)
    })

    test("allows deleting non-active profile when another is active", async () => {
      const config: Config = { agents: {}, categories: {} }
      await saveProfile(tempDir, "active", config)
      await saveProfile(tempDir, "inactive", config)
      await useProfile(tempDir, "active")

      await deleteProfile(tempDir, "inactive")

      const inactivePath = path.join(tempDir, "oh-my-opencode-inactive.json")
      const exists = await fs
        .access(inactivePath)
        .then(() => true)
        .catch(() => false)
      expect(exists).toBe(false)
    })

    test("throws ProfileNameError for invalid name", async () => {
      await expect(deleteProfile(tempDir, "invalid name")).rejects.toThrow(ProfileNameError)
    })
  })

  // ============================================================================
  // renameProfile Tests
  // ============================================================================
  describe("renameProfile", () => {
    test("renames profile file", async () => {
      const config: Config = { agents: {}, categories: {} }
      await saveProfile(tempDir, "old-name", config)

      await renameProfile(tempDir, "old-name", "new-name")

      const oldPath = path.join(tempDir, "oh-my-opencode-old-name.json")
      const newPath = path.join(tempDir, "oh-my-opencode-new-name.json")

      const oldExists = await fs
        .access(oldPath)
        .then(() => true)
        .catch(() => false)
      expect(oldExists).toBe(false)

      const newExists = await fs
        .access(newPath)
        .then(() => true)
        .catch(() => false)
      expect(newExists).toBe(true)
    })

    test("updates symlink when renaming active profile", async () => {
      const config: Config = { agents: {}, categories: {} }
      await saveProfile(tempDir, "active", config)
      await useProfile(tempDir, "active")

      await renameProfile(tempDir, "active", "renamed")

      const configPath = path.join(tempDir, "oh-my-opencode.json")
      const target = await fs.readlink(configPath)
      expect(target).toContain("oh-my-opencode-renamed.json")
      expect(target).not.toContain("oh-my-opencode-active.json")
    })

    test("throws ProfileNotFoundError when old profile doesn't exist", async () => {
      await expect(renameProfile(tempDir, "nonexistent", "new-name")).rejects.toThrow(
        ProfileNotFoundError,
      )
    })

    test("throws ProfileExistsError when new name already exists", async () => {
      const config: Config = { agents: {}, categories: {} }
      await saveProfile(tempDir, "existing", config)
      await saveProfile(tempDir, "to-rename", config)

      await expect(renameProfile(tempDir, "to-rename", "existing")).rejects.toThrow(
        ProfileExistsError,
      )
    })

    test("throws ProfileNameError for invalid new name", async () => {
      const config: Config = { agents: {}, categories: {} }
      await saveProfile(tempDir, "old-name", config)

      await expect(renameProfile(tempDir, "old-name", "invalid name")).rejects.toThrow(
        ProfileNameError,
      )
    })

    test("throws ProfileNameError for invalid old name", async () => {
      await expect(renameProfile(tempDir, "invalid name", "new-name")).rejects.toThrow(
        ProfileNameError,
      )
    })

    test("throws ProfileNameError for reserved new name", async () => {
      const config: Config = { agents: {}, categories: {} }
      await saveProfile(tempDir, "old-name", config)

      await expect(renameProfile(tempDir, "old-name", "default")).rejects.toThrow(ProfileNameError)
    })

    test("preserves profile content after rename", async () => {
      const config: Config = {
        agents: { oracle: { model: "gpt-4", variant: "high" } },
        categories: {},
      }
      await saveProfile(tempDir, "original", config)

      await renameProfile(tempDir, "original", "renamed")

      const profilePath = path.join(tempDir, "oh-my-opencode-renamed.json")
      const content = await fs.readFile(profilePath, "utf-8")
      const parsed = JSON.parse(content)

      expect(parsed).toEqual(config)
    })

    test("handles renaming non-active profile without touching symlink", async () => {
      const config: Config = { agents: {}, categories: {} }
      await saveProfile(tempDir, "active", config)
      await saveProfile(tempDir, "inactive", config)
      await useProfile(tempDir, "active")

      await renameProfile(tempDir, "inactive", "renamed-inactive")

      // Symlink should still point to active
      const configPath = path.join(tempDir, "oh-my-opencode.json")
      const target = await fs.readlink(configPath)
      expect(target).toContain("oh-my-opencode-active.json")
    })
  })

  // ============================================================================
  // Error Classes Tests
  // ============================================================================
  describe("error classes", () => {
    test("ProfileError has correct name", () => {
      const error = new ProfileError("test message")
      expect(error.name).toBe("ProfileError")
      expect(error.message).toBe("test message")
    })

    test("ProfileNameError has correct name and message", () => {
      const error = new ProfileNameError("bad-name", "test reason")
      expect(error.name).toBe("ProfileNameError")
      expect(error.message).toContain("bad-name")
      expect(error.message).toContain("test reason")
    })

    test("ProfileNotFoundError has correct name and message", () => {
      const error = new ProfileNotFoundError("missing")
      expect(error.name).toBe("ProfileNotFoundError")
      expect(error.message).toContain("missing")
    })

    test("ProfileActiveError has correct name and message", () => {
      const error = new ProfileActiveError("active")
      expect(error.name).toBe("ProfileActiveError")
      expect(error.message).toContain("active")
    })

    test("ProfileExistsError has correct name and message", () => {
      const error = new ProfileExistsError("exists")
      expect(error.name).toBe("ProfileExistsError")
      expect(error.message).toContain("exists")
    })

    test("DanglingSymlinkError has correct name and message", () => {
      const error = new DanglingSymlinkError("/path/to/target")
      expect(error.name).toBe("DanglingSymlinkError")
      expect(error.message).toContain("/path/to/target")
    })
  })
})
