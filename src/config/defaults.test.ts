import { describe, expect, it } from "bun:test"
import { DEFAULT_CONFIG } from "./defaults.js"

describe("DEFAULT_CONFIG upstream sync", () => {
  it("matches oh-my-opencode v3.8.0 agent defaults", () => {
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
    expect(DEFAULT_CONFIG.agents.atlas).toEqual({
      model: "kimi-for-coding/kimi-k2.5-free",
    })
    expect(DEFAULT_CONFIG.agents.librarian).toEqual({
      model: "zai-coding-plan/gemini-3-flash",
    })
    expect(DEFAULT_CONFIG.agents["multimodal-looker"]).toEqual({
      model: "google/kimi-k2.5-free",
    })
  })

  it("matches oh-my-opencode v3.8.0 category defaults", () => {
    expect(DEFAULT_CONFIG.categories["visual-engineering"]).toEqual({
      model: "google/gemini-3-pro",
      variant: "high",
    })
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
    expect(DEFAULT_CONFIG.categories.quick).toEqual({
      model: "anthropic/claude-haiku-4-5",
    })
    expect(DEFAULT_CONFIG.categories["unspecified-low"]).toEqual({
      model: "anthropic/claude-sonnet-4-6",
    })
    expect(DEFAULT_CONFIG.categories["unspecified-high"]).toEqual({
      model: "anthropic/claude-opus-4-6",
      variant: "max",
    })
    expect(DEFAULT_CONFIG.categories.writing).toEqual({
      model: "google/gemini-3-flash",
    })
  })
})
