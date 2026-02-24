import type { Config } from "#types/config.js"

/**
 * Default configuration synced with oh-my-opencode repository.
 *
 * Source of Truth:
 * https://github.com/code-yeongyu/oh-my-opencode/blob/v3.8.4/src/shared/model-requirements.ts
 *
 * Last Updated: Feb 2026 (v3.8.4)
 */
export const DEFAULT_CONFIG: Config = {
  agents: {
    sisyphus: { model: "anthropic/claude-opus-4-6", variant: "max" },
    hephaestus: { model: "openai/gpt-5.3-codex", variant: "medium" },
    oracle: { model: "openai/gpt-5.2", variant: "high" },
    librarian: { model: "zai-coding-plan/gemini-3-flash" },
    explore: { model: "x-ai/grok-code-fast-1" },
    "multimodal-looker": { model: "google/kimi-k2.5-free" },
    prometheus: { model: "anthropic/claude-opus-4-6", variant: "max" },
    metis: { model: "anthropic/claude-opus-4-6", variant: "max" },
    momus: { model: "openai/gpt-5.2", variant: "medium" },
    atlas: { model: "kimi-for-coding/kimi-k2.5-free" },
  },
  categories: {
    "visual-engineering": { model: "google/gemini-3-pro", variant: "high" },
    ultrabrain: { model: "openai/gpt-5.3-codex", variant: "xhigh" },
    deep: { model: "openai/gpt-5.3-codex", variant: "medium" },
    artistry: { model: "google/gemini-3-pro", variant: "high" },
    quick: { model: "anthropic/claude-haiku-4-5" },
    "unspecified-low": { model: "anthropic/claude-sonnet-4-6" },
    "unspecified-high": { model: "anthropic/claude-opus-4-6", variant: "max" },
    writing: { model: "google/gemini-3-flash" },
  },
}
