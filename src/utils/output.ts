import { log } from "@clack/prompts"
import chalk from "chalk"

// printLine/printBlank/printSeparator use console.log (not log.message)
// because log.message adds its own "│" bar + blank-line padding per call.

/** Print a line of text (replaces console.log) */
export function printLine(text: string): void {
  console.log(text)
}

/** Print a blank line (replaces console.log("")) */
export function printBlank(): void {
  console.log("")
}

/** Print a separator line (replaces console.log(chalk.dim("-".repeat(50)))) */
export function printSeparator(length = 50): void {
  console.log(chalk.dim("-".repeat(length)))
}

/** Print an error message (replaces console.error) */
export function printError(text: string): void {
  log.error(text)
}

/** Print a warning message */
export function printWarning(text: string): void {
  log.warn(text)
}

/** Print a success message */
export function printSuccess(text: string): void {
  log.success(text)
}

/** Print an info message */
export function printInfo(text: string): void {
  log.info(text)
}

/** Print a step message */
export function printStep(text: string): void {
  log.step(text)
}

// biome-ignore lint/suspicious/noControlCharactersInRegex: ANSI escape codes are control characters by definition
const ANSI_RE = /\x1b\[[0-9;]*m/g

function stripAnsi(str: string): string {
  return str.replace(ANSI_RE, "")
}

function padVisual(str: string, width: number): string {
  const visible = stripAnsi(str).length
  return str + " ".repeat(Math.max(0, width - visible))
}

export function printTable(data: Array<Record<string, string>>): void {
  if (data.length === 0) {
    return
  }

  const keys = Array.from(new Set(data.flatMap((row) => Object.keys(row))))

  const widths: Record<string, number> = {}
  for (const key of keys) {
    widths[key] = Math.max(
      key.length,
      ...data.map((row) => stripAnsi(String(row[key] ?? "")).length),
    )
  }

  const header = keys.map((key) => key.padEnd(widths[key] ?? 0)).join("  ")
  console.log(chalk.bold(header))

  const separator = keys.map((key) => "-".repeat(widths[key] ?? 0)).join("  ")
  console.log(chalk.dim(separator))

  for (const row of data) {
    const line = keys.map((key) => padVisual(String(row[key] ?? ""), widths[key] ?? 0)).join("  ")
    console.log(line)
  }
}
