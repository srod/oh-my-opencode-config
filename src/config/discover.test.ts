import { beforeEach, describe, expect, mock, test } from "bun:test"
import path from "node:path"
import { asMock } from "../test-utils/mocks.js"

const TEST_USER_CONFIG_FULL_PATH = "/home/test-user/.config/opencode/oh-my-opencode.json"
mock.module("./paths.js", () => ({
  CONFIG_FILE_NAME: "oh-my-opencode.json",
  PROJECT_CONFIG_DIR: ".opencode",
  USER_CONFIG_DIR: path.join(".config", "opencode"),
  PROJECT_CONFIG_REL_PATH: path.join(".opencode", "oh-my-opencode.json"),
  USER_CONFIG_FULL_PATH: TEST_USER_CONFIG_FULL_PATH,
  OPENCODE_CONFIG_DIR: "/home/test-user/.config/opencode",
  OPENCODE_CONFIG_FILE: "opencode.json",
  OPENCODE_CONFIG_PATH: "/home/test-user/.config/opencode/opencode.json",
  MODELS_CACHE_DIR: path.join(".cache", "opencode"),
  MODELS_CACHE_FILE: "models.json",
  MODELS_CACHE_PATH: "/home/test-user/.cache/opencode/models.json",
  AVAILABLE_MODELS_CACHE_FILE: "available-models.json",
  AVAILABLE_MODELS_CACHE_PATH: "/home/test-user/.cache/opencode/available-models.json",
  AVAILABLE_MODELS_CACHE_TTL_MS: 60 * 60 * 1000,
}))

mock.module("../utils/fs-sync.js", () => ({
  existsSync: mock(() => false),
}))

mock.module("../utils/execa.js", () => ({
  execaSync: mock(() => ({ stdout: "" })),
}))

const { existsSync } = await import("../utils/fs-sync.js")
const { execaSync } = await import("../utils/execa.js")
const { discoverConfigPath } = await import("./discover.js")
const { PROJECT_CONFIG_REL_PATH, USER_CONFIG_FULL_PATH } = await import("./paths.js")

describe("discoverConfigPath", () => {
  beforeEach(() => {
    asMock(existsSync).mockClear()
    asMock(execaSync).mockClear()
    asMock(existsSync).mockImplementation(() => false)
    asMock(execaSync).mockImplementation(() => ({ stdout: "" }))
  })

  test("should find project config in CWD", () => {
    const cwdConfigPath = path.join(process.cwd(), PROJECT_CONFIG_REL_PATH)
    asMock(existsSync).mockImplementation((p) => p === cwdConfigPath)

    const result = discoverConfigPath()
    expect(result).toBe(cwdConfigPath)
  })

  test("should find project config in git root if not in CWD", () => {
    const gitRoot = "/fake/git/root"
    const gitConfigPath = path.join(gitRoot, PROJECT_CONFIG_REL_PATH)

    asMock(existsSync).mockImplementation((p) => p === gitConfigPath)
    asMock(execaSync).mockImplementation(() => ({ stdout: gitRoot }))

    const result = discoverConfigPath()
    expect(result).toBe(gitConfigPath)
    expect(execaSync).toHaveBeenCalledWith("git", ["rev-parse", "--show-toplevel"])
  })

  test("should fall back to user config if no project config", () => {
    asMock(existsSync).mockImplementation((p) => p === USER_CONFIG_FULL_PATH)
    asMock(execaSync).mockImplementation(() => {
      throw new Error("not a git repo")
    })

    const result = discoverConfigPath()
    expect(result).toBe(USER_CONFIG_FULL_PATH)
  })

  test("should return null if no config found", () => {
    asMock(existsSync).mockImplementation(() => false)
    asMock(execaSync).mockImplementation(() => {
      throw new Error("not a git repo")
    })

    const result = discoverConfigPath()
    expect(result).toBeNull()
  })
})
