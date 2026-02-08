import { describe, expect, it } from "bun:test"
import { DEFAULT_CONFIG } from "./defaults.js"

describe("DEFAULT_CONFIG upstream sync", () => {
  it("matches oh-my-opencode v3.4.0 agent defaults", () => {
    expect(DEFAULT_CONFIG.agents.sisyphus).toEqual({
      model: "anthropic/claude-opus-4-6",
      variant: "max",
    })
    expect(DEFAULT_CONFIG.agents.hephaestus).toEqual({
      model: "openai/gpt-5.3-codex",
      variant: "medium",
    })
    expect(DEFAULT_CONFIG.agents.prometheus).toEqual({
      model: "anthropic/claude-opus-4-6",
      variant: "max",
    })
    expect(DEFAULT_CONFIG.agents.metis).toEqual({
      model: "anthropic/claude-opus-4-6",
      variant: "max",
    })
    expect(DEFAULT_CONFIG.agents.momus).toEqual({
      model: "openai/gpt-5.2",
      variant: "medium",
    })
  })

  it("matches oh-my-opencode v3.4.0 category defaults", () => {
    expect(DEFAULT_CONFIG.categories.ultrabrain).toEqual({
      model: "openai/gpt-5.3-codex",
      variant: "xhigh",
    })
    expect(DEFAULT_CONFIG.categories.deep).toEqual({
      model: "openai/gpt-5.3-codex",
      variant: "medium",
    })
    expect(DEFAULT_CONFIG.categories.artistry).toEqual({
      model: "google/gemini-3-pro",
      variant: "high",
    })
    expect(DEFAULT_CONFIG.categories["unspecified-high"]).toEqual({
      model: "anthropic/claude-opus-4-6",
      variant: "max",
    })
  })
})
