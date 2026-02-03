import { intro, outro } from "@clack/prompts"
import chalk from "chalk"
import { listBackups } from "#backup/manager.js"
import type { BaseCommandOptions } from "#cli/types.js"
import { DEFAULT_CONFIG } from "#config/defaults.js"
import { loadConfig } from "#config/loader.js"
import { resolveConfigPath } from "#config/resolve.js"
import { type DiffEntry, generateDiff } from "#diff/generator.js"
import { printBlank, printLine } from "#utils/output.js"

interface HistoryEntry {
  timestamp: string
  created: string
  adds: number
  modifies: number
  removes: number
  changes: DiffEntry[]
  isInitial: boolean
}

function formatChangeValue(value: unknown): string {
  if (typeof value === "object" && value !== null && "model" in value) {
    return String((value as Record<string, unknown>).model) || "none"
  }
  return "none"
}

async function buildHistoryEntries(
  backups: Awaited<ReturnType<typeof listBackups>>,
): Promise<HistoryEntry[]> {
  const history: HistoryEntry[] = []
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

export async function historyCommand(
  options: Pick<BaseCommandOptions, "config" | "json"> & { limit?: number },
): Promise<void> {
  const configPath = resolveConfigPath(options.config)
  const backups = await listBackups(configPath)
  const limitedBackups = options.limit ? backups.slice(0, options.limit) : backups

  const history = await buildHistoryEntries(limitedBackups)

  if (options.json) {
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

  intro(chalk.bold("Configuration History"))

  if (history.length === 0) {
    outro(chalk.yellow("No backups found."))
    return
  }

  printBlank()

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
  outro("")
}
