import path from "node:path"
import { cancel, intro, isCancel, outro, text } from "@clack/prompts"
import chalk from "chalk"
import { loadConfig } from "../../config/loader.js"
import { resolveConfigPath } from "../../config/resolve.js"
import { printLine } from "../../utils/output.js"
import type { BaseCommandOptions } from "../types.js"

export async function exportCommand(
  outputPath: string | undefined,
  options: Pick<BaseCommandOptions, "config" | "json">,
): Promise<void> {
  const configPath = resolveConfigPath(options.config)

  if (!options.json) {
    intro(chalk.bold("Export Configuration"))
  }

  const config = await loadConfig(configPath)

  let targetPath = outputPath
  if (!targetPath) {
    const input = await text({
      message: "Enter the path to export the configuration:",
      placeholder: "e.g., ./my-config.json",
      validate: (value) => {
        if (!value || value.trim().length === 0) {
          return "Path is required"
        }
        return undefined
      },
    })

    if (isCancel(input)) {
      cancel("Export cancelled.")
      return
    }

    targetPath = input
  }

  if (!path.extname(targetPath)) {
    targetPath = `${targetPath}.json`
  }

  const absolutePath = path.resolve(targetPath)

  try {
    const jsonContent = JSON.stringify(config, null, 2)
    await Bun.write(absolutePath, jsonContent)

    if (options.json) {
      printLine(JSON.stringify({ success: true, path: absolutePath }))
    } else {
      outro(chalk.green(`Configuration exported to ${chalk.cyan(absolutePath)}`))
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    if (options.json) {
      printLine(JSON.stringify({ success: false, error: errorMessage }))
      process.exit(1)
    } else {
      cancel(`Failed to export configuration: ${errorMessage}`)
    }
  }
}
