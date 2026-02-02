import { intro, isCancel, outro, select } from "@clack/prompts"
import chalk from "chalk"
import { printLine } from "../../../utils/output.js"
import type { BaseCommandOptions } from "../../types.js"
import { backupListCommand } from "../backup.js"
import { listCommand } from "../list.js"
import { menuConfigureAgents, menuConfigureCategories, menuQuickSetup } from "./configure.js"
import { menuDiff, menuHistory, menuUndo } from "./history.js"
import { menuExport, menuImport } from "./io.js"
import {
  menuBackupRestore,
  menuClearCache,
  menuRefresh,
  menuReset,
  showHelpCommand,
} from "./misc.js"
import { menuProfileDelete, menuProfileList, menuProfileSave, menuProfileUse } from "./profile.js"
import { menuDoctor, menuStatus } from "./status.js"

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
        { value: "profile-save", label: "💾 Save Profile", hint: "Save current config as profile" },
        { value: "profile-use", label: "📂 Load Profile", hint: "Switch to a saved profile" },
        { value: "profile-list", label: "📋 List Profiles", hint: "Show all saved profiles" },
        { value: "profile-delete", label: "🗑️ Delete Profile", hint: "Remove a saved profile" },
        { value: "backup-list", label: "📦 List Backups", hint: "Show available backups" },
        { value: "backup-restore", label: "⏪ Restore Backup", hint: "Restore from a backup" },
        { value: "reset", label: "🔄 Reset Config", hint: "Reset to default configuration" },
        { value: "clear-cache", label: "🧹 Clear Cache", hint: "Clear models cache" },
        { value: "help", label: "❓ Help", hint: "Show command help" },
        { value: "exit", label: "👋 Exit", hint: "Close the program" },
      ],
    })

    if (isCancel(action) || typeof action === "symbol") {
      exit = true
      break
    }

    try {
      switch (action) {
        case "status":
          await menuStatus(options)
          break
        case "doctor":
          await menuDoctor(options)
          break
        case "list":
          await listCommand({ config: options.config })
          break
        case "configure-agents":
          await menuConfigureAgents({ ...options, dryRun: false })
          break
        case "configure-categories":
          await menuConfigureCategories({ ...options, dryRun: false })
          break
        case "quick-setup":
          await menuQuickSetup({ config: options.config })
          break
        case "diff":
          await menuDiff({ config: options.config })
          break
        case "history":
          await menuHistory({ config: options.config })
          break
        case "undo":
          await menuUndo(options)
          break
        case "export":
          await menuExport(options)
          break
        case "import":
          await menuImport(options)
          break
        case "refresh":
          await menuRefresh()
          break
        case "help":
          await showHelpCommand()
          break
        case "profile-save":
          await menuProfileSave(options)
          break
        case "profile-use":
          await menuProfileUse(options)
          break
        case "profile-list":
          await menuProfileList(options)
          break
        case "profile-delete":
          await menuProfileDelete(options)
          break
        case "backup-list":
          await backupListCommand(options)
          break
        case "backup-restore":
          await menuBackupRestore(options)
          break
        case "reset":
          await menuReset(options)
          break
        case "clear-cache":
          await menuClearCache()
          break
        case "exit":
          exit = true
          break
      }
    } catch (error) {
      printLine(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`))
    }

    if (!exit) {
      printLine("")
      printLine(chalk.dim("Press Enter to continue..."))

      await new Promise((resolve) => {
        const listener = (data: Buffer) => {
          const str = data.toString()
          if (str.includes("\n") || str.includes("\r")) {
            process.stdin.removeListener("data", listener)
            process.stdin.pause()
            resolve(undefined)
          }
        }
        process.stdin.resume()
        process.stdin.once("data", listener)
      })
    }
  }

  outro(chalk.green("Goodbye!"))
}

export { menuConfigureAgents, menuConfigureCategories, menuQuickSetup } from "./configure.js"
export { menuDiff, menuHistory, menuUndo } from "./history.js"
export { menuExport, menuImport } from "./io.js"
export {
  menuBackupRestore,
  menuClearCache,
  menuRefresh,
  menuReset,
  showHelpCommand,
} from "./misc.js"
export {
  menuProfileDelete,
  menuProfileList,
  menuProfileSave,
  menuProfileUse,
} from "./profile.js"
export { menuDoctor, menuStatus } from "./status.js"
