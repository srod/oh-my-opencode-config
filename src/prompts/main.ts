import { select } from "@clack/prompts"
import chalk from "chalk"

export type MainMenuAction =
  | "list"
  | "configure-agents"
  | "configure-categories"
  | "reset"
  | "backups"
  | "exit"

export async function showMainMenu(): Promise<MainMenuAction | symbol> {
  const options: { value: MainMenuAction; label: string }[] = [
    { value: "list", label: `${chalk.blue("📋")} List current config` },
    { value: "configure-agents", label: `${chalk.green("🤖")} Configure Agents` },
    { value: "configure-categories", label: `${chalk.yellow("🏷️")} Configure Categories` },
    { value: "reset", label: `${chalk.red("🔄")} Reset to defaults` },
    { value: "backups", label: `${chalk.cyan("💾")} Backups` },
    { value: "exit", label: `${chalk.gray("🚪")} Exit` },
  ]
  return select({ message: "What would you like to do?", options })
}
