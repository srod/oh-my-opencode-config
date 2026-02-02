import { intro, outro, spinner } from "@clack/prompts"
import chalk from "chalk"
import { getAvailableModelIds } from "../../models/parser.js"

export async function refreshCommand() {
  intro(chalk.bold("Refresh Model Cache"))

  const s = spinner()
  s.start("Fetching available models from opencode")

  const modelIds = await getAvailableModelIds({ refresh: true })

  if (modelIds.size === 0) {
    s.stop("Failed to fetch models")
    outro(chalk.yellow("No models found. Make sure opencode is properly configured."))
    return
  }

  const providers = [...new Set([...modelIds].map((id) => id.split("/")[0]))]
  s.stop(`Cached ${modelIds.size} models from ${providers.length} providers`)

  outro(chalk.green("Model cache refreshed successfully!"))
}
