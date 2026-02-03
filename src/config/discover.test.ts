import { describe, expect, test } from "bun:test"
import path from "node:path"
import { discoverConfigPath } from "./discover.js"

const PROJECT_CONFIG_REL_PATH = path.join(".opencode", "oh-my-opencode.json")
const USER_CONFIG_FULL_PATH = "/home/test-user/.config/opencode/oh-my-opencode.json"

describe("discoverConfigPath", () => {
  test("should find project config in CWD", () => {
    const cwdConfigPath = path.join(process.cwd(), PROJECT_CONFIG_REL_PATH)
    const existsSyncMock = (p: string) => p === cwdConfigPath
    const execaSyncMock = (_file: string | URL, _args?: readonly string[]) => ({
      stdout: "",
    })

    const result = discoverConfigPath({
      existsSync: existsSyncMock,
      execaSync: execaSyncMock,
      projectConfigRelPath: PROJECT_CONFIG_REL_PATH,
      userConfigFullPath: USER_CONFIG_FULL_PATH,
    })
    expect(result).toBe(cwdConfigPath)
  })

  test("should find project config in git root if not in CWD", () => {
    const gitRoot = "/fake/git/root"
    const gitConfigPath = path.join(gitRoot, PROJECT_CONFIG_REL_PATH)
    const existsSyncMock = (p: string) => p === gitConfigPath
    const execaCalls: Array<{ file: string | URL; args?: readonly string[] }> = []
    const execaSyncMock = (file: string | URL, args?: readonly string[]) => {
      execaCalls.push({ file, args })
      return { stdout: gitRoot }
    }

    const result = discoverConfigPath({
      existsSync: existsSyncMock,
      execaSync: execaSyncMock,
      projectConfigRelPath: PROJECT_CONFIG_REL_PATH,
      userConfigFullPath: USER_CONFIG_FULL_PATH,
    })
    expect(result).toBe(gitConfigPath)
    expect(execaCalls[0]).toEqual({ file: "git", args: ["rev-parse", "--show-toplevel"] })
  })

  test("should fall back to user config if no project config", () => {
    const existsSyncMock = (p: string) => p === USER_CONFIG_FULL_PATH
    const execaSyncMock = () => {
      throw new Error("not a git repo")
    }

    const result = discoverConfigPath({
      existsSync: existsSyncMock,
      execaSync: execaSyncMock,
      projectConfigRelPath: PROJECT_CONFIG_REL_PATH,
      userConfigFullPath: USER_CONFIG_FULL_PATH,
    })
    expect(result).toBe(USER_CONFIG_FULL_PATH)
  })

  test("should return null if no config found", () => {
    const existsSyncMock = (_p: string) => false
    const execaSyncMock = () => {
      throw new Error("not a git repo")
    }

    const result = discoverConfigPath({
      existsSync: existsSyncMock,
      execaSync: execaSyncMock,
      projectConfigRelPath: PROJECT_CONFIG_REL_PATH,
      userConfigFullPath: USER_CONFIG_FULL_PATH,
    })
    expect(result).toBeNull()
  })
})
