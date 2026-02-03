import { describe, expect, test } from "bun:test"
import { resolveConfigPath } from "./resolve.js"

const MOCK_USER_CONFIG_PATH = "/home/user/.config/opencode/oh-my-opencode.json"

describe("resolveConfigPath", () => {
  test("returns configOption when provided as truthy string", () => {
    let discoverCalled = false
    const result = resolveConfigPath("/custom/path/config.json", {
      discoverConfigPath: () => {
        discoverCalled = true
        return null
      },
      userConfigFullPath: MOCK_USER_CONFIG_PATH,
    })
    expect(result).toBe("/custom/path/config.json")
    expect(discoverCalled).toBe(false)
  })

  test("falls back to discoverConfigPath when configOption is undefined", () => {
    const result = resolveConfigPath(undefined, {
      discoverConfigPath: () => "/discovered/path.json",
      userConfigFullPath: MOCK_USER_CONFIG_PATH,
    })
    expect(result).toBe("/discovered/path.json")
  })

  test("falls back to discoverConfigPath when configOption is null", () => {
    const result = resolveConfigPath(null, {
      discoverConfigPath: () => "/discovered/path.json",
      userConfigFullPath: MOCK_USER_CONFIG_PATH,
    })
    expect(result).toBe("/discovered/path.json")
  })

  test("falls back to discoverConfigPath when configOption is empty string", () => {
    const result = resolveConfigPath("", {
      discoverConfigPath: () => "/discovered/path.json",
      userConfigFullPath: MOCK_USER_CONFIG_PATH,
    })
    expect(result).toBe("/discovered/path.json")
  })

  test("falls back to userConfigFullPath when both configOption and discoverConfigPath are falsy", () => {
    const result = resolveConfigPath(undefined, {
      discoverConfigPath: () => null,
      userConfigFullPath: MOCK_USER_CONFIG_PATH,
    })
    expect(result).toBe(MOCK_USER_CONFIG_PATH)
  })

  test("uses || semantics: empty string is falsy and falls through", () => {
    const result = resolveConfigPath("", {
      discoverConfigPath: () => null,
      userConfigFullPath: MOCK_USER_CONFIG_PATH,
    })
    expect(result).toBe(MOCK_USER_CONFIG_PATH)
  })
})
