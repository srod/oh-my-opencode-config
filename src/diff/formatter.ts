import chalk from "chalk"
import { colorizeAgent } from "#types/colors.js"
import { AgentConfigSchema } from "#types/config.js"
import type { DiffEntry } from "./generator.js"

export function formatDiff(entries: DiffEntry[]): string {
  if (entries.length === 0) {
    return "No changes detected."
  }

  return entries
    .map((entry) => {
      const prefix = getPrefix(entry.type)
      const path = colorizePath(entry.path)

      switch (entry.type) {
        case "add":
          return `${prefix} ${path}: ${chalk.green(formatValue(entry.new))}`
        case "remove":
          return `${prefix} ${path}: ${chalk.red(formatValue(entry.old))}`
        case "modify":
          return `${prefix} ${path}: ${chalk.red(formatValue(entry.old))} -> ${chalk.green(formatValue(entry.new))}`
        default:
          return ""
      }
    })
    .join("\n")
}

export function formatDiffJson(entries: DiffEntry[]): string {
  return JSON.stringify(entries, null, 2)
}

function getPrefix(type: string): string {
  switch (type) {
    case "add":
      return chalk.green("+")
    case "remove":
      return chalk.red("-")
    case "modify":
      return chalk.yellow("~")
    default:
      return " "
  }
}

function colorizePath(path: string): string {
  const dotIndex = path.indexOf(".")
  if (dotIndex === -1) return chalk.bold(path)
  const section = path.slice(0, dotIndex)
  const name = path.slice(dotIndex + 1)
  return `${chalk.bold(section)}.${colorizeAgent(name)}`
}

function formatValue(val: unknown): string {
  const result = AgentConfigSchema.safeParse(val)
  if (result.success) {
    const { model, variant } = result.data
    return variant ? `${model} (${variant})` : model
  }
  return "none"
}
