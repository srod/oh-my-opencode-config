import { select, text } from "@clack/prompts"
import chalk from "chalk"
import type { Model } from "../types/models.js"
import { Capability } from "../types/requirements.js"
import { type AgentName, validateModelForAgent } from "../validation/capabilities.js"

export type ActionValue = "SEARCH_ACTION" | "SHOW_ALL_ACTION" | "BACK_ACTION"

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
  let filteredModels = [...options.models]
  let searchTerm = ""

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const modelOptions = filteredModels.map((model) => {
      const validation = validateModelForAgent(model, options.agentName)
      const isCurrent = model.id === options.currentModelId

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
    })

    const searchOption = {
      value: "SEARCH_ACTION",
      label: `${chalk.cyan("🔍")} Search/Filter...`,
      hint: searchTerm ? `Current filter: "${searchTerm}"` : undefined,
    }

    const showAllOption = searchTerm
      ? {
          value: "SHOW_ALL_ACTION",
          label: `${chalk.gray("❌")} Clear filter`,
        }
      : null

    const backOption = {
      value: "BACK_ACTION",
      label: `${chalk.yellow("←")} Back to providers`,
    }

    const selectOptions = [
      searchOption,
      ...(showAllOption ? [showAllOption] : []),
      backOption,
      ...modelOptions,
    ]

    const selection = await select({
      message: `Select model for ${chalk.bold(options.agentName)} ${searchTerm ? `(filter: "${searchTerm}")` : ""}`,
      options: selectOptions,
    })

    if (selection === "SEARCH_ACTION") {
      const term = await text({
        message: "Enter search term:",
        placeholder: "e.g. gpt-4",
        initialValue: searchTerm,
      })

      if (typeof term === "symbol") return term
      searchTerm = term
      filteredModels = options.models.filter((m) => m.id.toLowerCase().includes(term.toLowerCase()))
      continue
    }

    if (selection === "SHOW_ALL_ACTION") {
      searchTerm = ""
      filteredModels = [...options.models]
      continue
    }

    if (selection === "BACK_ACTION") {
      return "BACK_ACTION"
    }

    if (typeof selection === "symbol") return selection

    const selectedModel = options.models.find((m) => m.id === selection)
    if (!selectedModel) {
      return Symbol("model-not-found")
    }
    return selectedModel
  }
}
