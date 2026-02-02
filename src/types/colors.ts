import chalk from "chalk"

/**
 * Agent brand colors from oh-my-opencode.
 * @see https://github.com/code-yeongyu/oh-my-opencode
 */
export const AGENT_COLORS: Readonly<Record<string, string>> = {
  sisyphus: "#00CED1", // Dark Turquoise
  prometheus: "#9D4EDD", // Amethyst Purple
  atlas: "#10B981", // Emerald Green
  hephaestus: "#FF4500", // Magma Orange
  "sisyphus-junior": "#20B2AA", // Light Sea Green (used by categories)
}

/**
 * Colorize an agent or category name using its brand color.
 * Falls back to default chalk.bold for names without a defined color.
 */
export function colorizeAgent(name: string): string {
  const hex = AGENT_COLORS[name]
  return hex ? chalk.hex(hex).bold(name) : chalk.bold(name)
}
