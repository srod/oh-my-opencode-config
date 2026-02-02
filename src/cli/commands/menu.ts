import { intro, outro, select } from "@clack/prompts"
import chalk from "chalk"
import { printLine } from "../../utils/output.js"
import type { BaseCommandOptions } from "../types.js"
import { configureAgentsCommand, configureCategoriesCommand } from "./configure.js"
import { diffCommand } from "./diff.js"
import { doctorCommand } from "./doctor.js"
import { exportCommand } from "./export.js"
import { historyCommand } from "./history.js"
import { importCommand } from "./import.js"
import { listCommand } from "./list.js"
import { quickSetupCommand } from "./quick-setup.js"
import { refreshCommand } from "./refresh.js"
import { statusCommand } from "./status.js"
import { undoCommand } from "./undo.js"

export async function mainMenuCommand(
  options: Pick<BaseCommandOptions, "config" | "opencodeConfig" | "refresh">,
) {
  intro(chalk.bold("oh-my-opencode-config"))

  let exit = false

  while (!exit) {
    const action = await select({
      message: "What would you like to do?",
      options: [
        { value: "status", label: "📊 Status", hint: "View configuration status" },
        { value: "doctor", label: "🔍 Doctor", hint: "Diagnose and validate configuration" },
        { value: "list", label: "📋 List", hint: "Show current configuration" },
        {
          value: "configure-agents",
          label: "🤖 Configure Agents",
          hint: "Assign models to agents",
        },
        {
          value: "configure-categories",
          label: "📁 Configure Categories",
          hint: "Assign models to categories",
        },
        {
          value: "quick-setup",
          label: "🚀 Quick Setup",
          hint: "Apply preset configurations",
        },
        { value: "diff", label: "📑 Diff", hint: "Compare with defaults" },
        { value: "history", label: "📜 History", hint: "View change history" },
        { value: "undo", label: "↩️ Undo", hint: "Restore previous configuration" },
        { value: "export", label: "📤 Export", hint: "Export configuration to file" },
        { value: "import", label: "📥 Import", hint: "Import configuration from file" },
        { value: "refresh", label: "🔄 Refresh Cache", hint: "Update available models" },
        { value: "exit", label: "👋 Exit", hint: "Close the program" },
      ],
    })

    if (typeof action === "symbol") {
      exit = true
      break
    }

    switch (action) {
      case "status":
        await statusCommand(options)
        break
      case "doctor":
        await doctorCommand(options)
        break
      case "list":
        await listCommand({ config: options.config })
        break
      case "configure-agents":
        await configureAgentsCommand({ ...options, dryRun: false })
        break
      case "configure-categories":
        await configureCategoriesCommand({ ...options, dryRun: false })
        break
      case "quick-setup":
        await quickSetupCommand({ config: options.config })
        break
      case "diff":
        await diffCommand({ config: options.config })
        break
      case "history":
        await historyCommand(options)
        break
      case "undo":
        await undoCommand(options)
        break
      case "export":
        await exportCommand(undefined, options)
        break
      case "import":
        await importCommand(undefined, options)
        break
      case "refresh":
        await refreshCommand()
        break
      case "exit":
        exit = true
        break
    }

    if (!exit) {
      printLine(chalk.dim("\nPress any key to continue..."))
      await new Promise((resolve) => process.stdin.once("data", resolve))
    }
  }

  outro(chalk.green("Goodbye!"))
}
