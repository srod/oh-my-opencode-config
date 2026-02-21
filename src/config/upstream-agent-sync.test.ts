import { describe, expect, it } from "bun:test"
import {
  applyAgentDefaultsToDefaultsFile,
  buildExpectedAgentDefaults,
  buildExpectedCategoryDefaults,
  diffAgentDefaults,
  diffCategoryDefaults,
  parseUpstreamAgentRequirements,
  parseUpstreamCategoryRequirements,
} from "./upstream-agent-sync.js"

describe("parseUpstreamAgentRequirements", () => {
  it("parses first fallback model and variant for each upstream agent", () => {
    const source = `
export const AGENT_MODEL_REQUIREMENTS: Record<string, ModelRequirement> = {
  sisyphus: {
    fallbackChain: [
      { providers: ["anthropic"], model: "claude-opus-4-6", variant: "max" },
      { providers: ["zai-coding-plan"], model: "glm-4.7" },
    ],
  },
  "multimodal-looker": {
    fallbackChain: [
      { providers: ["google"], model: "gemini-3-flash" },
    ],
  },
}

export const CATEGORY_MODEL_REQUIREMENTS: Record<string, ModelRequirement> = {}
`

    const parsed = parseUpstreamAgentRequirements(source)
    expect(parsed.sisyphus).toEqual({ model: "claude-opus-4-6", variant: "max" })
    expect(parsed["multimodal-looker"]).toEqual({ model: "gemini-3-flash" })
  })

  it("supports single-quoted object keys", () => {
    const source = `
export const AGENT_MODEL_REQUIREMENTS: Record<string, ModelRequirement> = {
  'multimodal-looker': {
    fallbackChain: [
      { providers: ["google"], model: "gemini-3-flash" },
    ],
  },
}

export const CATEGORY_MODEL_REQUIREMENTS: Record<string, ModelRequirement> = {}
`

    const parsed = parseUpstreamAgentRequirements(source)
    expect(parsed["multimodal-looker"]).toEqual({ model: "gemini-3-flash" })
  })

  it("throws contextual error when braces cannot be matched", () => {
    const source = `
export const AGENT_MODEL_REQUIREMENTS: Record<string, ModelRequirement> = {
  sisyphus: {
    fallbackChain: [
      { providers: ["anthropic"], model: "claude-opus-4-6", variant: "max" },
    ],
  }

export const CATEGORY_MODEL_REQUIREMENTS: Record<string, ModelRequirement> = {}
`

    expect(() => parseUpstreamAgentRequirements(source)).toThrow(
      "Failed to match closing brace for object starting at index",
    )
  })
})

describe("parseUpstreamCategoryRequirements", () => {
  it("parses first fallback model and variant for each upstream category", () => {
    const source = `
export const AGENT_MODEL_REQUIREMENTS: Record<string, ModelRequirement> = {}

export const CATEGORY_MODEL_REQUIREMENTS: Record<string, ModelRequirement> = {
  writing: {
    fallbackChain: [
      { providers: ["google"], model: "gemini-3-flash" },
      { providers: ["anthropic"], model: "claude-sonnet-4-6" },
    ],
  },
  "unspecified-low": {
    fallbackChain: [
      { providers: ["anthropic"], model: "claude-sonnet-4-6" },
    ],
  },
}
`

    const parsed = parseUpstreamCategoryRequirements(source)
    expect(parsed.writing).toEqual({ model: "gemini-3-flash" })
    expect(parsed["unspecified-low"]).toEqual({ model: "claude-sonnet-4-6" })
  })
})

describe("buildExpectedAgentDefaults", () => {
  it("preserves provider prefix while syncing model and variant", () => {
    const current = {
      sisyphus: { model: "anthropic/claude-opus-4-5", variant: "max" },
      momus: { model: "openai/gpt-5.2" },
      explore: { model: "x-ai/grok-code-fast-1", variant: "low" },
      local: { model: "custom-model" },
    }

    const upstream = {
      sisyphus: { model: "anthropic/claude-opus-4-6", variant: "max" },
      momus: { model: "gpt-5.2", variant: "medium" },
      explore: { model: "grok-code-fast-1" },
      local: { model: "openai/gpt-5-mini" },
    }

    const expected = buildExpectedAgentDefaults(current, upstream)
    expect(expected.sisyphus).toEqual({ model: "anthropic/claude-opus-4-6", variant: "max" })
    expect(expected.momus).toEqual({ model: "openai/gpt-5.2", variant: "medium" })
    expect(expected.explore).toEqual({ model: "x-ai/grok-code-fast-1" })
    expect(expected.local).toEqual({ model: "openai/gpt-5-mini" })
  })
})

describe("diffAgentDefaults", () => {
  it("returns changed entries", () => {
    const current = {
      hephaestus: { model: "openai/gpt-5.2-codex" },
    }
    const expected = {
      hephaestus: { model: "openai/gpt-5.3-codex", variant: "medium" },
    }

    expect(diffAgentDefaults(current, expected)).toEqual([
      {
        agent: "hephaestus",
        current: { model: "openai/gpt-5.2-codex" },
        expected: { model: "openai/gpt-5.3-codex", variant: "medium" },
      },
    ])
  })
})

describe("buildExpectedCategoryDefaults", () => {
  it("preserves provider prefix while syncing category model and variant", () => {
    const current = {
      writing: { model: "kimi-for-coding/k2p5" },
      "unspecified-low": { model: "anthropic/claude-sonnet-4-5" },
    }
    const upstream = {
      writing: { model: "gemini-3-flash" },
      "unspecified-low": { model: "claude-sonnet-4-6" },
    }

    const expected = buildExpectedCategoryDefaults(current, upstream)
    expect(expected.writing).toEqual({ model: "kimi-for-coding/gemini-3-flash" })
    expect(expected["unspecified-low"]).toEqual({ model: "anthropic/claude-sonnet-4-6" })
  })
})

describe("diffCategoryDefaults", () => {
  it("returns changed category entries", () => {
    const current = {
      writing: { model: "kimi-for-coding/k2p5" },
    }
    const expected = {
      writing: { model: "google/gemini-3-flash" },
    }

    expect(diffCategoryDefaults(current, expected)).toEqual([
      {
        category: "writing",
        current: { model: "kimi-for-coding/k2p5" },
        expected: { model: "google/gemini-3-flash" },
      },
    ])
  })
})

describe("applyAgentDefaultsToDefaultsFile", () => {
  it("updates the agents block and sync metadata while preserving categories", () => {
    const content = `import type { Config } from "#types/config.js"

/**
 * Source of Truth:
 * https://github.com/code-yeongyu/oh-my-opencode/blob/main/src/shared/model-requirements.ts
 *
 * Last Updated: Jan 2026 (v3.0.0)
 */
export const DEFAULT_CONFIG: Config = {
  agents: {
    sisyphus: { model: "anthropic/claude-opus-4-5", variant: "max" },
    "multimodal-looker": { model: "google/gemini-3-flash" },
  },
  categories: {
    writing: { model: "google/gemini-3-flash" },
  },
}
`

    const updated = applyAgentDefaultsToDefaultsFile(
      content,
      {
        sisyphus: { model: "anthropic/claude-opus-4-6", variant: "max" },
        "multimodal-looker": { model: "google/gemini-3-flash" },
      },
      "v3.4.0",
      new Date("2026-02-08T12:00:00Z"),
    )

    expect(updated).toContain(
      "* https://github.com/code-yeongyu/oh-my-opencode/blob/v3.4.0/src/shared/model-requirements.ts",
    )
    expect(updated).toContain("* Last Updated: Feb 2026 (v3.4.0)")
    expect(updated).toContain('sisyphus: { model: "anthropic/claude-opus-4-6", variant: "max" },')
    expect(updated).toContain('"multimodal-looker": { model: "google/gemini-3-flash" },')
    expect(updated).toContain('writing: { model: "google/gemini-3-flash" },')
  })

  it("updates both agents and categories when expected categories are provided", () => {
    const content = `import type { Config } from "#types/config.js"

/**
 * Source of Truth:
 * https://github.com/code-yeongyu/oh-my-opencode/blob/main/src/shared/model-requirements.ts
 *
 * Last Updated: Jan 2026 (v3.0.0)
 */
export const DEFAULT_CONFIG: Config = {
  agents: {
    atlas: { model: "kimi-for-coding/k2p5" },
  },
  categories: {
    writing: { model: "kimi-for-coding/k2p5" },
    "unspecified-low": { model: "anthropic/claude-sonnet-4-5" },
  },
}
`

    const updated = applyAgentDefaultsToDefaultsFile(
      content,
      {
        atlas: { model: "kimi-for-coding/kimi-k2.5-free" },
      },
      "v3.8.0",
      new Date("2026-02-21T12:00:00Z"),
      {
        writing: { model: "google/gemini-3-flash" },
        "unspecified-low": { model: "anthropic/claude-sonnet-4-6" },
      },
    )

    expect(updated).toContain('atlas: { model: "kimi-for-coding/kimi-k2.5-free" },')
    expect(updated).toContain('writing: { model: "google/gemini-3-flash" },')
    expect(updated).toContain('"unspecified-low": { model: "anthropic/claude-sonnet-4-6" },')
  })
})
