import { describe, expect, test } from "bun:test"
import type { Config } from "../types/config.js"
import { generateDiff } from "./generator.js"

describe("generateDiff", () => {
  test("returns empty array for identical configs", () => {
    const config: Config = {
      agents: { oracle: { model: "gpt-4" } },
      categories: { quick: { model: "gpt-3.5" } },
    }
    expect(generateDiff(config, config)).toEqual([])
  })

  test("detects added agents", () => {
    const oldConfig: Config = { agents: {} }
    const newConfig: Config = { agents: { oracle: { model: "gpt-4" } } }
    const diff = generateDiff(oldConfig, newConfig)
    expect(diff).toEqual([
      {
        type: "add",
        path: "agents.oracle",
        new: { model: "gpt-4" },
      },
    ])
  })

  test("detects removed agents", () => {
    const oldConfig: Config = { agents: { oracle: { model: "gpt-4" } } }
    const newConfig: Config = { agents: {} }
    const diff = generateDiff(oldConfig, newConfig)
    expect(diff).toEqual([
      {
        type: "remove",
        path: "agents.oracle",
        old: { model: "gpt-4" },
      },
    ])
  })

  test("detects modified agents", () => {
    const oldConfig: Config = { agents: { oracle: { model: "gpt-4" } } }
    const newConfig: Config = { agents: { oracle: { model: "gpt-4o" } } }
    const diff = generateDiff(oldConfig, newConfig)
    expect(diff).toEqual([
      {
        type: "modify",
        path: "agents.oracle",
        old: { model: "gpt-4" },
        new: { model: "gpt-4o" },
      },
    ])
  })

  test("detects modified variants", () => {
    const oldConfig: Config = { agents: { oracle: { model: "gpt-4", variant: "old" } } }
    const newConfig: Config = { agents: { oracle: { model: "gpt-4", variant: "new" } } }
    const diff = generateDiff(oldConfig, newConfig)
    expect(diff).toEqual([
      {
        type: "modify",
        path: "agents.oracle",
        old: { model: "gpt-4", variant: "old" },
        new: { model: "gpt-4", variant: "new" },
      },
    ])
  })

  test("compares categories as well", () => {
    const oldConfig: Config = { categories: { quick: { model: "gpt-3.5" } } }
    const newConfig: Config = { categories: { quick: { model: "gpt-4" } } }
    const diff = generateDiff(oldConfig, newConfig)
    expect(diff).toEqual([
      {
        type: "modify",
        path: "categories.quick",
        old: { model: "gpt-3.5" },
        new: { model: "gpt-4" },
      },
    ])
  })

  test("sorts entries by path", () => {
    const oldConfig: Config = {
      agents: { z: { model: "m" } },
      categories: { a: { model: "m" } },
    }
    const newConfig: Config = {
      agents: { z: { model: "m2" } },
      categories: { a: { model: "m2" } },
    }
    const diff = generateDiff(oldConfig, newConfig)
    expect(diff[0].path).toBe("agents.z")
    expect(diff[1].path).toBe("categories.a")
  })
})
