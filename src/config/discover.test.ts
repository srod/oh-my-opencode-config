import { beforeEach, describe, expect, mock, test } from "bun:test"
import fs from "node:fs"
import path from "node:path"
import { execaSync } from "execa"
import { asMock } from "../test-utils/mocks.js"
import { discoverConfigPath } from "./discover.js"
import { PROJECT_CONFIG_REL_PATH, USER_CONFIG_FULL_PATH } from "./paths.js"

mock.module("fs", () => ({
  default: {
    existsSync: mock(() => false),
  },
}))

mock.module("execa", () => ({
  execaSync: mock(() => ({ stdout: "" })),
}))

describe("discoverConfigPath", () => {
  beforeEach(() => {
    asMock(fs.existsSync).mockClear()
    asMock(execaSync).mockClear()
    asMock(fs.existsSync).mockImplementation(() => false)
    asMock(execaSync).mockImplementation(() => ({ stdout: "" }))
  })

  test("should find project config in CWD", () => {
    const cwdConfigPath = path.join(process.cwd(), PROJECT_CONFIG_REL_PATH)
    asMock(fs.existsSync).mockImplementation((p) => p === cwdConfigPath)

    const result = discoverConfigPath()
    expect(result).toBe(cwdConfigPath)
  })

  test("should find project config in git root if not in CWD", () => {
    const gitRoot = "/fake/git/root"
    const gitConfigPath = path.join(gitRoot, PROJECT_CONFIG_REL_PATH)

    asMock(fs.existsSync).mockImplementation((p) => p === gitConfigPath)
    asMock(execaSync).mockImplementation(() => ({ stdout: gitRoot }))

    const result = discoverConfigPath()
    expect(result).toBe(gitConfigPath)
    expect(execaSync).toHaveBeenCalledWith("git", ["rev-parse", "--show-toplevel"])
  })

  test("should fall back to user config if no project config", () => {
    asMock(fs.existsSync).mockImplementation((p) => p === USER_CONFIG_FULL_PATH)
    asMock(execaSync).mockImplementation(() => {
      throw new Error("not a git repo")
    })

    const result = discoverConfigPath()
    expect(result).toBe(USER_CONFIG_FULL_PATH)
  })

  test("should return null if no config found", () => {
    asMock(fs.existsSync).mockImplementation(() => false)
    asMock(execaSync).mockImplementation(() => {
      throw new Error("not a git repo")
    })

    const result = discoverConfigPath()
    expect(result).toBeNull()
  })
})
