import { intro, outro, spinner } from "@clack/prompts"
import chalk from "chalk"
import { AVAILABLE_MODELS_CACHE_PATH } from "../../config/paths.js"
import { clearAvailableModelsCache } from "../../models/parser.js"
import { printLine } from "../../utils/output.js"

export async function clearCacheCommand() {
  intro(chalk.bold("Clear Cache"))

  const s = spinner()
  s.start("Clearing available models cache")

  await clearAvailableModelsCache()

  s.stop("Available models cache cleared")

  printLine(chalk.dim(`Cleared: ${AVAILABLE_MODELS_CACHE_PATH}`))

  outro(chalk.green("Cache cleared successfully!"))
}
