import { cancel, confirm, intro, isCancel, outro, text } from "@clack/prompts"
import chalk from "chalk"
import { promptAndCreateBackup } from "../../backup/prompt.js"
import { loadConfig } from "../../config/loader.js"
import { resolveConfigPath } from "../../config/resolve.js"
import { saveConfig } from "../../config/writer.js"
import { formatDiff } from "../../diff/formatter.js"
import { generateDiff } from "../../diff/generator.js"
import { ConfigSchema } from "../../types/config.js"
import { getFileMtime } from "../../utils/fs.js"
import { printLine } from "../../utils/output.js"
import type { BaseCommandOptions } from "../types.js"

export async function importCommand(
  inputPath: string | undefined,
  options: Pick<BaseCommandOptions, "config" | "dryRun">,
): Promise<void> {
  const configPath = resolveConfigPath(options.config)

  const initialMtime = await getFileMtime(configPath)

  const currentConfig = await loadConfig(configPath)

  let importPath = inputPath
  if (!importPath) {
    intro(chalk.bold("Import Configuration"))

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
      cancel("Operation cancelled.")
      return
    }

    importPath = pathResult
  } else {
    intro(chalk.bold("Import Configuration"))
  }

  const importFile = Bun.file(importPath)
  if (!(await importFile.exists())) {
    cancel(chalk.red(`File not found: ${importPath}`))
    return
  }

  let importedRaw: unknown
  try {
    const content = await importFile.text()
    importedRaw = JSON.parse(content)
  } catch (error) {
    if (error instanceof SyntaxError) {
      cancel(chalk.red(`Invalid JSON: ${error.message}`))
      return
    }
    cancel(
      chalk.red(`Failed to read file: ${error instanceof Error ? error.message : String(error)}`),
    )
    return
  }

  const validationResult = ConfigSchema.safeParse(importedRaw)

  if (!validationResult.success) {
    const issues = validationResult.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("\n  - ")
    cancel(chalk.red(`Schema validation failed:\n  - ${issues}`))
    return
  }

  const importedConfig = validationResult.data

  const diffEntries = generateDiff(currentConfig, importedConfig)

  if (diffEntries.length === 0) {
    outro("No changes detected. Configuration is already up to date.")
    return
  }

  printLine(`\n${chalk.bold("Changes to be applied:")}`)
  printLine(`${formatDiff(diffEntries)}\n`)

  if (options.dryRun) {
    outro(chalk.yellow("Dry run: No changes applied."))
    return
  }

  const fileExists = await Bun.file(configPath).exists()
  if (fileExists) {
    const backupCreated = await promptAndCreateBackup(configPath)
    if (!backupCreated) {
      const proceedWithoutBackup = await confirm({
        message: "Continue without backup?",
        initialValue: false,
      })

      if (isCancel(proceedWithoutBackup) || !proceedWithoutBackup) {
        cancel("Import cancelled.")
        return
      }
    }
  }

  const shouldApply = await confirm({
    message: "Apply the imported configuration?",
    initialValue: true,
  })

  if (isCancel(shouldApply) || !shouldApply) {
    cancel("Import cancelled. No changes were made.")
    return
  }

  await saveConfig({ filePath: configPath, config: importedConfig, expectedMtime: initialMtime })

  outro(chalk.green("Configuration imported successfully!"))
}
