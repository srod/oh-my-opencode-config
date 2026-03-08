import { DEFAULT_CONFIG } from "#config/defaults.js"
import type { Config } from "#types/config.js"

export type QuickSetupPreset = "standard" | "economy" | "anthropic"
export type PresetConfig = {
  agents: NonNullable<Config["agents"]>
  categories: NonNullable<Config["categories"]>
}

type QuickSetupPresetOption = {
  value: QuickSetupPreset
  label: string
  hint: string
}

const QUICK_SETUP_PRESET_VALUES = [
  "standard",
  "economy",
  "anthropic",
] as const satisfies readonly QuickSetupPreset[]

export function isQuickSetupPreset(value: string): value is QuickSetupPreset {
  return QUICK_SETUP_PRESET_VALUES.some((preset) => preset === value)
}

export const QUICK_SETUP_PRESET_OPTIONS: QuickSetupPresetOption[] = [
  {
    value: "standard",
    label: "Standard (Recommended)",
    hint: "Default high-performance models (GPT-5.4, Claude Opus)",
  },
  {
    value: "economy",
    label: "Economy",
    hint: "Cost-effective models (Haiku, Flash, GPT-4o Mini)",
  },
  {
    value: "anthropic",
    label: "Anthropic",
    hint: "Anthropic-first models (Opus, Sonnet, Haiku)",
  },
]

function toPresetConfig(config: Config): PresetConfig {
  const { agents, categories } = config
  if (agents === undefined || categories === undefined) {
    throw new Error("Preset configs require both agents and categories")
  }

  return { agents, categories }
}

const ECONOMY_CONFIG: PresetConfig = {
  agents: {
    sisyphus: { model: "anthropic/claude-haiku-4-5" },
    hephaestus: { model: "anthropic/claude-haiku-4-5" },
    oracle: { model: "openai/gpt-4o" },
    librarian: { model: "openai/gpt-4o-mini" },
    explore: { model: "anthropic/claude-haiku-4-5" },
    "multimodal-looker": { model: "google/gemini-3-flash" },
    prometheus: { model: "anthropic/claude-haiku-4-5" },
    metis: { model: "anthropic/claude-haiku-4-5" },
    momus: { model: "openai/gpt-4o-mini" },
    atlas: { model: "google/gemini-3-flash" },
  },
  categories: {
    "visual-engineering": { model: "google/gemini-3-flash" },
    ultrabrain: { model: "openai/gpt-4o" },
    deep: { model: "openai/gpt-4o" },
    artistry: { model: "google/gemini-3-flash" },
    quick: { model: "anthropic/claude-haiku-4-5" },
    "unspecified-low": { model: "anthropic/claude-haiku-4-5" },
    "unspecified-high": { model: "anthropic/claude-sonnet-4-5" },
    writing: { model: "google/gemini-3-flash" },
  },
}

const ANTHROPIC_CONFIG: PresetConfig = {
  agents: {
    sisyphus: { model: "anthropic/claude-opus-4-6", variant: "max" },
    hephaestus: { model: "anthropic/claude-sonnet-4-6" },
    oracle: { model: "anthropic/claude-opus-4-6", variant: "max" },
    librarian: { model: "anthropic/claude-haiku-4-5" },
    explore: { model: "anthropic/claude-haiku-4-5" },
    "multimodal-looker": { model: "anthropic/claude-sonnet-4-6" },
    prometheus: { model: "anthropic/claude-opus-4-6", variant: "max" },
    metis: { model: "anthropic/claude-opus-4-6", variant: "max" },
    momus: { model: "anthropic/claude-sonnet-4-6" },
    atlas: { model: "anthropic/claude-sonnet-4-6" },
  },
  categories: {
    "visual-engineering": { model: "anthropic/claude-sonnet-4-6" },
    ultrabrain: { model: "anthropic/claude-opus-4-6", variant: "max" },
    deep: { model: "anthropic/claude-opus-4-6", variant: "max" },
    artistry: { model: "anthropic/claude-sonnet-4-6" },
    quick: { model: "anthropic/claude-haiku-4-5" },
    "unspecified-low": { model: "anthropic/claude-haiku-4-5" },
    "unspecified-high": { model: "anthropic/claude-opus-4-6", variant: "max" },
    writing: { model: "anthropic/claude-sonnet-4-6" },
  },
}

export const PRESET_CONFIGS: Record<QuickSetupPreset, PresetConfig> = {
  standard: toPresetConfig(DEFAULT_CONFIG),
  economy: ECONOMY_CONFIG,
  anthropic: ANTHROPIC_CONFIG,
}
