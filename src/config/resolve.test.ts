import { beforeEach, describe, expect, mock, test } from "bun:test"
import { resolveConfigPath } from "./resolve.js"

const mockDiscoverConfigPath = mock((): string | null => null)
const mockUserConfigPath = "/home/user/.config/Claude/oh-my-Claude.json"

beforeEach(() => {
  mockDiscoverConfigPath.mockClear()
})

mock.module("./discover.js", () => ({
  discoverConfigPath: mockDiscoverConfigPath,
}))

mock.module("./paths.js", () => ({
  USER_CONFIG_FULL_PATH: mockUserConfigPath,
}))

describe("resolveConfigPath", () => {
  test("returns configOption when provided as truthy string", () => {
    const result = resolveConfigPath("/custom/path/config.json")
    expect(result).toBe("/custom/path/config.json")
    expect(mockDiscoverConfigPath).not.toHaveBeenCalled()
  })

  test("falls back to discoverConfigPath when configOption is undefined", () => {
    mockDiscoverConfigPath.mockReturnValue("/discovered/path.json")
    const result = resolveConfigPath(undefined)
    expect(result).toBe("/discovered/path.json")
    expect(mockDiscoverConfigPath).toHaveBeenCalled()
  })

  test("falls back to discoverConfigPath when configOption is null", () => {
    mockDiscoverConfigPath.mockReturnValue("/discovered/path.json")
    const result = resolveConfigPath(null)
    expect(result).toBe("/discovered/path.json")
    expect(mockDiscoverConfigPath).toHaveBeenCalled()
  })

  test("falls back to discoverConfigPath when configOption is empty string", () => {
    mockDiscoverConfigPath.mockReturnValue("/discovered/path.json")
    const result = resolveConfigPath("")
    expect(result).toBe("/discovered/path.json")
    expect(mockDiscoverConfigPath).toHaveBeenCalled()
  })

  test("falls back to USER_CONFIG_FULL_PATH when both configOption and discoverConfigPath are falsy", () => {
    mockDiscoverConfigPath.mockReturnValue(null)
    const result = resolveConfigPath(undefined)
    expect(result).toBe(mockUserConfigPath)
  })

  test("uses || semantics: empty string is falsy and falls through", () => {
    mockDiscoverConfigPath.mockReturnValue(null)
    const result = resolveConfigPath("")
    expect(result).toBe(mockUserConfigPath)
  })
})
