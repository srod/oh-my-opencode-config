import { describe, expect, test } from "bun:test"
import { formatDiff, formatDiffJson } from "./formatter.js"
import type { DiffEntry } from "./generator.js"

describe("formatter", () => {
  const entries: DiffEntry[] = [
    { type: "add", path: "agents.oracle", new: { model: "gpt-4" } },
    {
      type: "modify",
      path: "categories.quick",
      old: { model: "gpt-3.5" },
      new: { model: "gpt-4" },
    },
  ]

  test("formatDiffJson returns valid JSON string", () => {
    const json = formatDiffJson(entries)
    expect(JSON.parse(json)).toEqual(entries)
  })

  test("formatDiff returns human readable string", () => {
    const output = formatDiff(entries)
    expect(output).toContain("agents.oracle")
    expect(output).toContain("categories.quick")
    expect(output).toContain("gpt-4")
  })

  test("formatDiff handles empty entries", () => {
    expect(formatDiff([])).toBe("No changes detected.")
  })
})
