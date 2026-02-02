import type { Config } from "../types/config.js"

/**
 * Default configuration synced with oh-my-opencode repository.
 *
 * Sources of Truth:
 * - Agents: https://github.com/code-yeongyu/oh-my-opencode/blob/main/src/shared/model-requirements.ts
 * - Categories: https://github.com/code-yeongyu/oh-my-opencode/blob/main/src/tools/delegate-task/constants.ts
 *
 * Last Updated: Feb 2026
 */
export const DEFAULT_CONFIG: Config = {
  agents: {
    sisyphus: { model: "anthropic/claude-opus-4-5", variant: "max" },
    hephaestus: { model: "openai/gpt-5.2-codex" },
    oracle: { model: "openai/gpt-5.2", variant: "high" },
    librarian: { model: "zai-coding-plan/glm-4.7" },
    explore: { model: "anthropic/claude-haiku-4-5" },
    "multimodal-looker": { model: "google/gemini-3-flash" },
    prometheus: { model: "anthropic/claude-opus-4-5" },
    metis: { model: "anthropic/claude-opus-4-5" },
    momus: { model: "openai/gpt-5.2" },
    atlas: { model: "kimi-for-coding/k2p5" },
  },
  categories: {
    "visual-engineering": { model: "google/gemini-3-pro" },
    ultrabrain: { model: "openai/gpt-5.2-codex", variant: "xhigh" },
    deep: { model: "openai/gpt-5.2-codex", variant: "medium" },
    artistry: { model: "google/gemini-3-pro", variant: "max" },
    quick: { model: "anthropic/claude-haiku-4-5" },
    "unspecified-low": { model: "anthropic/claude-sonnet-4-5" },
    "unspecified-high": { model: "anthropic/claude-opus-4-5", variant: "max" },
    writing: { model: "google/gemini-3-flash" },
  },
}
