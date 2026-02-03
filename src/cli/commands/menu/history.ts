import { confirm, isCancel } from "@clack/prompts"
import chalk from "chalk"
import { listBackups, restoreBackup } from "../../../backup/manager.js"
import { DEFAULT_CONFIG } from "../../../config/defaults.js"
import { loadConfig } from "../../../config/loader.js"
import { resolveConfigPath } from "../../../config/resolve.js"
import { formatDiff, formatDiffJson } from "../../../diff/formatter.js"
import { generateDiff } from "../../../diff/generator.js"
import { printBlank, printLine, printSeparator } from "../../../utils/output.js"
import type { BaseCommandOptions } from "../../types.js"

export async function menuDiff(
  options: Pick<BaseCommandOptions, "config" | "json">,
): Promise<void> {
  const configPath = resolveConfigPath(options.config)
  const config = await loadConfig(configPath)
  const diffEntries = generateDiff(DEFAULT_CONFIG, config)

  if (options.json) {
    printLine(formatDiffJson(diffEntries))
    return
  }

  if (diffEntries.length === 0) {
    printLine(chalk.green("✓ Current configuration matches defaults."))
    return
  }

  printLine(chalk.dim(`\nComparing to defaults:`))
  printLine(chalk.dim(`Current: ${configPath}\n`))

  const adds = diffEntries.filter((e) => e.type === "add")
  const modifies = diffEntries.filter((e) => e.type === "modify")
  const removes = diffEntries.filter((e) => e.type === "remove")

  printLine(formatDiff(diffEntries))
  printLine("")
  printSeparator()
  const summaryParts = [
    chalk.green(`${adds.length} added`),
    chalk.yellow(`${modifies.length} modified`),
    chalk.red(`${removes.length} removed`),
  ]
  printLine(`Summary: ${summaryParts.join(" ")}`)
}

export async function menuHistory(
  options: Pick<BaseCommandOptions, "config" | "json"> & { limit?: number },
): Promise<void> {
  const configPath = resolveConfigPath(options.config)
  const backups = await listBackups(configPath)
  const limitedBackups = options.limit ? backups.slice(0, options.limit) : backups

  if (options.json) {
    const history = await buildHistoryEntries(limitedBackups)
    const jsonOutput = history.map((h) => ({
      timestamp: h.timestamp,
      created: h.created,
      changes: {
        added: h.adds,
        modified: h.modifies,
        removed: h.removes,
      },
      details: h.changes,
    }))
    printLine(JSON.stringify(jsonOutput, null, 2))
    return
  }

  if (backups.length === 0) {
    printLine(chalk.yellow("No backups found."))
    return
  }

  printBlank()
  const history = await buildHistoryEntries(limitedBackups)

  for (const entry of history) {
    printLine(`${chalk.cyan(entry.timestamp)} ${chalk.dim(`(${entry.created})`)}`)

    if (entry.isInitial) {
      printLine(`  ${chalk.dim("Changes:")} Initial config (from defaults)`)
    } else {
      const parts: string[] = []
      if (entry.adds > 0) parts.push(chalk.green(`${entry.adds} added`))
      if (entry.modifies > 0) parts.push(chalk.yellow(`${entry.modifies} modified`))
      if (entry.removes > 0) parts.push(chalk.red(`${entry.removes} removed`))
      const summary = parts.length > 0 ? parts.join(", ") : "No changes"
      printLine(`  ${chalk.dim("Changes:")} ${summary}`)
    }

    for (const change of entry.changes.slice(0, 5)) {
      const icon = change.type === "add" ? "+" : change.type === "remove" ? "-" : "~"
      const color =
        change.type === "add" ? chalk.green : change.type === "remove" ? chalk.red : chalk.yellow

      if (change.type === "modify") {
        printLine(
          `  ${color(icon)} ${change.path}: ${chalk.dim(formatChangeValue(change.old))} → ${formatChangeValue(change.new)}`,
        )
      } else if (change.type === "add") {
        printLine(
          `  ${color(icon)} ${change.path}: ${chalk.dim("(none)")} → ${formatChangeValue(change.new)}`,
        )
      } else {
        printLine(
          `  ${color(icon)} ${change.path}: ${formatChangeValue(change.old)} → ${chalk.dim("(none)")}`,
        )
      }
    }

    if (entry.changes.length > 5) {
      printLine(chalk.dim(`  ... and ${entry.changes.length - 5} more changes`))
    }

    printBlank()
  }

  printLine(chalk.dim(`Total backups: ${backups.length}`))
}

async function buildHistoryEntries(backups: Awaited<ReturnType<typeof listBackups>>): Promise<
  {
    timestamp: string
    created: string
    adds: number
    modifies: number
    removes: number
    changes: ReturnType<typeof generateDiff>
    isInitial: boolean
  }[]
> {
  const history: {
    timestamp: string
    created: string
    adds: number
    modifies: number
    removes: number
    changes: ReturnType<typeof generateDiff>
    isInitial: boolean
  }[] = []
  let previousConfig = DEFAULT_CONFIG

  const sortedBackups = [...backups].sort((a, b) => a.timestamp.localeCompare(b.timestamp))

  for (const backup of sortedBackups) {
    const backupConfig = await loadConfig(backup.path)
    const diff = generateDiff(previousConfig, backupConfig)

    history.push({
      timestamp: backup.timestamp,
      created: backup.created.toLocaleString(),
      adds: diff.filter((e) => e.type === "add").length,
      modifies: diff.filter((e) => e.type === "modify").length,
      removes: diff.filter((e) => e.type === "remove").length,
      changes: diff,
      isInitial: previousConfig === DEFAULT_CONFIG && diff.length > 0,
    })

    previousConfig = backupConfig
  }

  history.reverse()
  return history
}

function formatChangeValue(value: unknown): string {
  if (typeof value === "object" && value !== null && "model" in value) {
    return String((value as Record<string, unknown>).model) || "none"
  }
  return "none"
}

export async function menuUndo(
  options: Pick<BaseCommandOptions, "config" | "dryRun">,
): Promise<void> {
  const configPath = resolveConfigPath(options.config)
  const backups = await listBackups(configPath)
  const mostRecentBackup = backups[0]

  if (mostRecentBackup === undefined) {
    printLine(chalk.yellow("No backups found. Cannot undo."))
    return
  }

  const timestamp = mostRecentBackup.timestamp

  printLine(chalk.dim(`Config: ${configPath}`))
  printLine(chalk.cyan(`Most recent backup: ${timestamp}`))
  printLine(chalk.dim(`Created: ${mostRecentBackup.created.toLocaleString()}`))
  printBlank()

  if (options.dryRun) {
    printLine(chalk.yellow(`Dry run: Would restore backup ${timestamp}`))
    return
  }

  const shouldRestore = await confirm({
    message: `Restore backup ${timestamp}?`,
    initialValue: true,
  })

  if (isCancel(shouldRestore) || !shouldRestore) {
    printLine(chalk.yellow("Undo cancelled."))
    return
  }

  await restoreBackup(configPath, timestamp)
  printLine(chalk.green(`Successfully restored backup ${timestamp}`))
}
