import chalk from "chalk"
import type { Model } from "#types/models.js"
import { Capability } from "#types/requirements.js"
import { type AgentName, validateModelForAgent } from "#validation/capabilities.js"
import { searchableSelect } from "./search.js"

export type ActionValue = "BACK_ACTION"

export interface SelectModelOptions {
  models: Model[]
  agentName: AgentName
  currentModelId?: string
  onRefresh?: () => Promise<Model[]>
}

/**
 * Builds a comma-separated list of capability names supported by the model.
 *
 * @param model - The model to inspect for supported capabilities
 * @returns A comma-separated string of capability names supported by `model`, or an empty string if none
 */
function getCapabilitiesDisplay(model: Model): string {
  const caps: string[] = []
  for (const cap of Object.values(Capability)) {
    if (model.capabilities?.[cap] || model[cap] === true) {
      caps.push(cap)
    }
  }
  return caps.join(", ")
}

/**
 * Present a searchable list of models for the given agent and return the user's selection.
 *
 * @param options - Configuration for model selection:
 *   - models: Array of available models to display
 *   - agentName: Agent name used to validate model capabilities
 *   - currentModelId: Optional model id to mark as the current selection
 *   - onRefresh: Optional callback to refresh the model list
 * @returns The selected `Model`, a `symbol` for special UI actions, or the `ActionValue` `'BACK_ACTION'` when the back option is chosen
 */
export async function selectModel(
  options: SelectModelOptions,
): Promise<Model | symbol | ActionValue> {
  return searchableSelect({
    items: options.models,
    getOption: (model) => {
      const validation = validateModelForAgent(model, options.agentName)
      const currentModelId = options.currentModelId
      const isCurrent =
        model.id === currentModelId ||
        (currentModelId?.includes("/") &&
          !model.id.includes("/") &&
          currentModelId.endsWith(`/${model.id}`)) ||
        (!currentModelId?.includes("/") &&
          model.id.includes("/") &&
          model.id.endsWith(`/${currentModelId}`))

      let prefix = ""
      if (isCurrent) prefix += chalk.blue("● ")
      else prefix += "  "

      if (validation.valid) prefix += chalk.green("✓ ")
      else prefix += chalk.yellow("⚠ ")

      const caps = getCapabilitiesDisplay(model)
      const hint = validation.valid
        ? chalk.dim(caps)
        : chalk.yellow(`Missing: ${validation.missing.join(", ")}`)

      return {
        value: model.id,
        label: `${prefix}${model.id}`,
        hint: hint || undefined,
      }
    },
    getSearchText: (model) => model.id,
    message: (searchTerm) =>
      `Select model for ${chalk.bold(options.agentName)} ${searchTerm ? `(filter: "${searchTerm}")` : ""}`,
    searchPlaceholder: "e.g. gpt-4",
    onRefresh: options.onRefresh,
    refreshLabel: "Refresh models",
    backLabel: "Back to providers",
    canGoBack: true,
  })
}
