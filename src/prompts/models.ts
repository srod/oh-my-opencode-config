import chalk from "chalk"
import type { Model } from "../types/models.js"
import { Capability } from "../types/requirements.js"
import { type AgentName, validateModelForAgent } from "../validation/capabilities.js"
import { searchableSelect } from "./search.js"

export type ActionValue = "BACK_ACTION"

export interface SelectModelOptions {
  models: Model[]
  agentName: AgentName
  currentModelId?: string
}

function getCapabilitiesDisplay(model: Model): string {
  const caps: string[] = []
  for (const cap of Object.values(Capability)) {
    if (model.capabilities?.[cap] || model[cap] === true) {
      caps.push(cap)
    }
  }
  return caps.join(", ")
}

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
    backLabel: "Back to providers",
    canGoBack: true,
  })
}
