import type { Config } from "#types/config.js"

/**
 * Default configuration synced with oh-my-opencode repository.
 *
 * Source of Truth:
 * https://github.com/code-yeongyu/oh-my-opencode/blob/v3.11.1/src/shared/model-requirements.ts
 *
 * Last Updated: Mar 2026 (v3.11.1)
 */
export const DEFAULT_CONFIG: Config = {
  agents: {
    sisyphus: { model: "anthropic/claude-opus-4-6", variant: "max" },
    hephaestus: { model: "openai/gpt-5.3-codex", variant: "medium" },
    oracle: { model: "openai/gpt-5.4", variant: "high" },
    librarian: { model: "google/gemini-3-flash" },
    explore: { model: "github-copilot/grok-code-fast-1" },
    "multimodal-looker": { model: "openai/gpt-5.4", variant: "medium" },
    prometheus: { model: "anthropic/claude-opus-4-6", variant: "max" },
    metis: { model: "anthropic/claude-opus-4-6", variant: "max" },
    momus: { model: "openai/gpt-5.4", variant: "xhigh" },
    atlas: { model: "anthropic/claude-sonnet-4-6" },
  },
  categories: {
    "visual-engineering": { model: "google/gemini-3.1-pro", variant: "high" },
    ultrabrain: { model: "openai/gpt-5.3-codex", variant: "xhigh" },
    deep: { model: "openai/gpt-5.3-codex", variant: "medium" },
    artistry: { model: "google/gemini-3.1-pro", variant: "high" },
    quick: { model: "anthropic/claude-haiku-4-5" },
    "unspecified-low": { model: "anthropic/claude-sonnet-4-6" },
    "unspecified-high": { model: "openai/gpt-5.4", variant: "high" },
    writing: { model: "google/gemini-3-flash" },
  },
}
