import path from "node:path"
import { confirm, isCancel, text } from "@clack/prompts"
import chalk from "chalk"
import { loadConfig } from "#config/loader.js"
import { resolveConfigPath } from "#config/resolve.js"
import { saveConfig } from "#config/writer.js"
import { formatDiff } from "#diff/formatter.js"
import { generateDiff } from "#diff/generator.js"
import { getFileMtime } from "#utils/fs.js"
import { printLine } from "#utils/output.js"
import type { BaseCommandOptions } from "#cli/types.js"

export async function menuExport(
  options: Pick<BaseCommandOptions, "config" | "json">,
): Promise<void> {
  const configPath = resolveConfigPath(options.config)
  const config = await loadConfig(configPath)

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
    printLine(chalk.yellow("Export cancelled."))
    return
  }

  let targetPath = input
  if (!path.extname(targetPath)) {
    targetPath = `${targetPath}.json`
  }

  const absolutePath = path.resolve(targetPath)

  try {
    const jsonContent = JSON.stringify(config, null, 2)
    await Bun.write(absolutePath, jsonContent)
    printLine(chalk.green(`Configuration exported to ${chalk.cyan(absolutePath)}`))
  } catch (error) {
    printLine(
      chalk.red(`Failed to export: ${error instanceof Error ? error.message : String(error)}`),
    )
  }
}

export async function menuImport(
  options: Pick<BaseCommandOptions, "config" | "dryRun">,
): Promise<void> {
  const configPath = resolveConfigPath(options.config)
  const initialMtime = await getFileMtime(configPath)
  const currentConfig = await loadConfig(configPath)

  const pathResult = await text({
    message: "Enter the path to the JSON file to import:",
    placeholder: "./my-config.json",
    validate: (value) => {
      if (!value || value.trim().length === 0) {
        return "Please enter a file path"
      }
      return undefined
    },
  })

  if (isCancel(pathResult)) {
    printLine(chalk.yellow("Operation cancelled."))
    return
  }

  const importFile = Bun.file(pathResult)
  if (!(await importFile.exists())) {
    printLine(chalk.red(`File not found: ${pathResult}`))
    return
  }

  let importedRaw: unknown
  try {
    const content = await importFile.text()
    importedRaw = JSON.parse(content)
  } catch (error) {
    if (error instanceof SyntaxError) {
      printLine(chalk.red(`Invalid JSON: ${error.message}`))
    } else {
      printLine(
        chalk.red(`Failed to read file: ${error instanceof Error ? error.message : String(error)}`),
      )
    }
    return
  }

  const { ConfigSchema } = await import("#types/config.js")
  const validationResult = ConfigSchema.safeParse(importedRaw)

  if (!validationResult.success) {
    const issues = validationResult.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("\n  - ")
    printLine(chalk.red(`Schema validation failed:\n  - ${issues}`))
    return
  }

  const importedConfig = validationResult.data
  const diffEntries = generateDiff(currentConfig, importedConfig)

  if (diffEntries.length === 0) {
    printLine(chalk.yellow("No changes detected. Configuration is already up to date."))
    return
  }

  printLine(`\n${chalk.bold("Changes to be applied:")}`)
  printLine(`${formatDiff(diffEntries)}\n`)

  if (options.dryRun) {
    printLine(chalk.yellow("Dry run: No changes applied."))
    return
  }

  const shouldApply = await confirm({
    message: "Apply the imported configuration?",
    initialValue: true,
  })

  if (isCancel(shouldApply) || !shouldApply) {
    printLine(chalk.yellow("Import cancelled. No changes were made."))
    return
  }

  await saveConfig({ filePath: configPath, config: importedConfig, expectedMtime: initialMtime })
  printLine(chalk.green("Configuration imported successfully!"))
}
