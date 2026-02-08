import { describe, expect, it } from "bun:test"
import { getGitHubApiHeaders } from "./sync-agent-defaults.js"

describe("getGitHubApiHeaders", () => {
  it("always includes Accept header", () => {
    expect(getGitHubApiHeaders({})).toEqual({
      Accept: "application/vnd.github+json",
    })
  })

  it("adds Authorization header when GITHUB_TOKEN is set", () => {
    expect(getGitHubApiHeaders({ GITHUB_TOKEN: "test-token" })).toEqual({
      Accept: "application/vnd.github+json",
      Authorization: "Bearer test-token",
    })
  })
})
