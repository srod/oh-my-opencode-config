import { describe, expect, test } from "bun:test"
import path from "node:path"
import { discoverConfigPath } from "./discover.js"

const PROJECT_CONFIG_REL_PATH = path.join(".opencode", "oh-my-opencode.json")
const USER_CONFIG_FULL_PATH = "/home/test-user/.config/opencode/oh-my-opencode.json"

describe("discoverConfigPath", () => {
  test("should find project config in CWD", () => {
    const cwdConfigPath = path.join(process.cwd(), PROJECT_CONFIG_REL_PATH)
    const existsSyncMock = (p: string) => p === cwdConfigPath

    const result = discoverConfigPath({
      existsSync: existsSyncMock,
      projectConfigRelPath: PROJECT_CONFIG_REL_PATH,
      userConfigFullPath: USER_CONFIG_FULL_PATH,
    })
    expect(result).toBe(cwdConfigPath)
  })

  test("should fall back to user config if no project config", () => {
    const existsSyncMock = (p: string) => p === USER_CONFIG_FULL_PATH

    const result = discoverConfigPath({
      existsSync: existsSyncMock,
      projectConfigRelPath: PROJECT_CONFIG_REL_PATH,
      userConfigFullPath: USER_CONFIG_FULL_PATH,
    })
    expect(result).toBe(USER_CONFIG_FULL_PATH)
  })

  test("should return null if no config found", () => {
    const existsSyncMock = (_p: string) => false

    const result = discoverConfigPath({
      existsSync: existsSyncMock,
      projectConfigRelPath: PROJECT_CONFIG_REL_PATH,
      userConfigFullPath: USER_CONFIG_FULL_PATH,
    })
    expect(result).toBeNull()
  })
})
