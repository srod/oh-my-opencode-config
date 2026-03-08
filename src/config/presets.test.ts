import { describe, expect, it } from "bun:test"
import { DEFAULT_CONFIG } from "./defaults.js"
import { PRESET_CONFIGS, QUICK_SETUP_PRESET_OPTIONS, type QuickSetupPreset } from "./presets.js"

describe("QUICK_SETUP_PRESET_OPTIONS", () => {
  it("includes the anthropic preset alongside standard and economy", () => {
    expect(QUICK_SETUP_PRESET_OPTIONS.map((option) => option.value)).toEqual([
      "standard",
      "economy",
      "anthropic",
    ] satisfies QuickSetupPreset[])
  })
})

describe("PRESET_CONFIGS", () => {
  it("uses the current defaults as the standard preset", () => {
    expect(PRESET_CONFIGS.standard).toEqual({
      agents: DEFAULT_CONFIG.agents,
      categories: DEFAULT_CONFIG.categories,
    })
  })

  it("keeps every anthropic preset model on the anthropic provider", () => {
    const anthropicEntries = [
      ...Object.values(PRESET_CONFIGS.anthropic.agents ?? {}),
      ...Object.values(PRESET_CONFIGS.anthropic.categories ?? {}),
    ]

    expect(anthropicEntries.length).toBeGreaterThan(0)
    for (const entry of anthropicEntries) {
      expect(entry.model.startsWith("anthropic/")).toBe(true)
    }
  })

  it("uses opus for high-end roles and sonnet for multimodal and writing roles", () => {
    expect(PRESET_CONFIGS.anthropic.agents?.sisyphus).toEqual({
      model: "anthropic/claude-opus-4-6",
      variant: "max",
    })
    expect(PRESET_CONFIGS.anthropic.agents?.["multimodal-looker"]).toEqual({
      model: "anthropic/claude-sonnet-4-6",
    })
    expect(PRESET_CONFIGS.anthropic.categories?.writing).toEqual({
      model: "anthropic/claude-sonnet-4-6",
    })
    expect(PRESET_CONFIGS.anthropic.categories?.quick).toEqual({
      model: "anthropic/claude-haiku-4-5",
    })
  })

  it("copies the default preset maps instead of reusing DEFAULT_CONFIG references", () => {
    expect(PRESET_CONFIGS.standard.agents).not.toBe(DEFAULT_CONFIG.agents)
    expect(PRESET_CONFIGS.standard.categories).not.toBe(DEFAULT_CONFIG.categories)
    expect(PRESET_CONFIGS.standard).toEqual({
      agents: DEFAULT_CONFIG.agents,
      categories: DEFAULT_CONFIG.categories,
    })
  })
})
