import { intro, isCancel, outro, select } from "@clack/prompts"
import chalk from "chalk"
import { backupListCommand } from "#cli/commands/backup.js"
import { listCommand } from "#cli/commands/list.js"
import type { BaseCommandOptions } from "#cli/types.js"
import { printLine } from "#utils/output.js"
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
import {
  menuProfileDelete,
  menuProfileList,
  menuProfileSave,
  menuProfileTemplate,
  menuProfileUse,
} from "./profile.js"
import { menuDoctor, menuStatus } from "./status.js"

type MenuOption<T extends string> = {
  value: T
  label: string
  hint?: string
}

type MainMenuCategory =
  | "overview"
  | "configure"
  | "profiles"
  | "history-safety"
  | "io"
  | "cache"
  | "help"
  | "exit"

type MenuAction =
  | "status"
  | "doctor"
  | "list"
  | "configure-agents"
  | "configure-categories"
  | "quick-setup"
  | "diff"
  | "history"
  | "undo"
  | "export"
  | "import"
  | "refresh"
  | "profile-save"
  | "profile-template"
  | "profile-use"
  | "profile-list"
  | "profile-delete"
  | "backup-list"
  | "backup-restore"
  | "reset"
  | "clear-cache"

const backOption: MenuOption<"back"> = {
  value: "back",
  label: "↩️ Back",
  hint: "Return to main menu",
}

function withBackOption<T extends string>(
  options: ReadonlyArray<MenuOption<T>>,
): MenuOption<T | "back">[] {
  return [...options, backOption]
}

async function waitForEnter(): Promise<void> {
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
    process.stdin.on("data", listener)
  })
}

async function runSubmenu(
  message: string,
  options: ReadonlyArray<MenuOption<MenuAction>>,
  onAction: (action: MenuAction) => Promise<void>,
): Promise<"back" | "exit"> {
  while (true) {
    const action = await select({
      message,
      options: withBackOption(options),
    })

    if (isCancel(action) || typeof action === "symbol") {
      return "exit"
    }

    if (action === "back") {
      return "back"
    }

    await onAction(action)
    await waitForEnter()
  }
}

export async function mainMenuCommand(
  options: Pick<BaseCommandOptions, "config" | "opencodeConfig" | "refresh">,
) {
  intro(chalk.bold("oh-my-opencode-config"))

  const actionHandlers: Record<MenuAction, () => Promise<void>> = {
    status: async () => {
      await menuStatus(options)
    },
    doctor: async () => {
      await menuDoctor(options)
    },
    list: async () => {
      await listCommand({ config: options.config })
    },
    "configure-agents": async () => {
      await menuConfigureAgents({ ...options, dryRun: false })
    },
    "configure-categories": async () => {
      await menuConfigureCategories({ ...options, dryRun: false })
    },
    "quick-setup": async () => {
      await menuQuickSetup({ config: options.config })
    },
    diff: async () => {
      await menuDiff({ config: options.config })
    },
    history: async () => {
      await menuHistory({ config: options.config })
    },
    undo: async () => {
      await menuUndo(options)
    },
    export: async () => {
      await menuExport(options)
    },
    import: async () => {
      await menuImport(options)
    },
    refresh: async () => {
      await menuRefresh()
    },
    "profile-save": async () => {
      await menuProfileSave(options)
    },
    "profile-template": async () => {
      await menuProfileTemplate(options)
    },
    "profile-use": async () => {
      await menuProfileUse(options)
    },
    "profile-list": async () => {
      await menuProfileList(options)
    },
    "profile-delete": async () => {
      await menuProfileDelete(options)
    },
    "backup-list": async () => {
      await backupListCommand(options)
    },
    "backup-restore": async () => {
      await menuBackupRestore(options)
    },
    reset: async () => {
      await menuReset(options)
    },
    "clear-cache": async () => {
      await menuClearCache()
    },
  }

  const overviewOptions: ReadonlyArray<MenuOption<MenuAction>> = [
    { value: "status", label: "📊 Status", hint: "View configuration status" },
    { value: "doctor", label: "🔍 Doctor", hint: "Diagnose and validate configuration" },
    { value: "list", label: "📋 List", hint: "Show current configuration" },
    { value: "diff", label: "📑 Diff", hint: "Compare with defaults" },
  ]

  const configureOptions: ReadonlyArray<MenuOption<MenuAction>> = [
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
    { value: "reset", label: "🔄 Reset Config", hint: "Reset to default configuration" },
  ]

  const profileOptions: ReadonlyArray<MenuOption<MenuAction>> = [
    { value: "profile-save", label: "💾 Save Profile", hint: "Save current config as profile" },
    {
      value: "profile-template",
      label: "🧩 Create Template",
      hint: "Write oh-my-opencode.template.json",
    },
    { value: "profile-use", label: "📂 Load Profile", hint: "Switch to a saved profile" },
    { value: "profile-list", label: "📋 List Profiles", hint: "Show all saved profiles" },
    { value: "profile-delete", label: "🗑️ Delete Profile", hint: "Remove a saved profile" },
  ]

  const historyOptions: ReadonlyArray<MenuOption<MenuAction>> = [
    { value: "history", label: "📜 History", hint: "View change history" },
    { value: "undo", label: "↩️ Undo", hint: "Restore previous configuration" },
    { value: "backup-list", label: "📦 List Backups", hint: "Show available backups" },
    { value: "backup-restore", label: "⏪ Restore Backup", hint: "Restore from a backup" },
  ]

  const ioOptions: ReadonlyArray<MenuOption<MenuAction>> = [
    { value: "export", label: "📤 Export", hint: "Export configuration to file" },
    { value: "import", label: "📥 Import", hint: "Import configuration from file" },
  ]

  const cacheOptions: ReadonlyArray<MenuOption<MenuAction>> = [
    { value: "refresh", label: "🔄 Refresh Cache", hint: "Update available models" },
    { value: "clear-cache", label: "🧹 Clear Cache", hint: "Clear models cache" },
  ]

  const mainOptions: MenuOption<MainMenuCategory>[] = [
    {
      value: "overview",
      label: "📌 Overview",
      hint: "Status, doctor, list, diff",
    },
    {
      value: "configure",
      label: "🧩 Configure",
      hint: "Agents, categories, quick setup, reset",
    },
    {
      value: "profiles",
      label: "👤 Profiles",
      hint: "Save, load, list, delete",
    },
    {
      value: "history-safety",
      label: "🧭 History & Safety",
      hint: "History, undo, backups",
    },
    { value: "io", label: "📦 Import/Export", hint: "Import or export config files" },
    { value: "cache", label: "🧰 Cache & Models", hint: "Refresh or clear cache" },
    { value: "help", label: "❓ Help", hint: "Show command help" },
    { value: "exit", label: "👋 Exit", hint: "Close the program" },
  ]

  let exit = false

  while (!exit) {
    const category = await select({
      message: "What would you like to do?",
      options: mainOptions,
    })

    if (isCancel(category) || typeof category === "symbol") {
      exit = true
      break
    }

    try {
      switch (category) {
        case "overview": {
          const result = await runSubmenu("Overview", overviewOptions, async (action) => {
            await actionHandlers[action]()
          })
          if (result === "exit") {
            exit = true
          }
          break
        }
        case "configure": {
          const result = await runSubmenu("Configure", configureOptions, async (action) => {
            await actionHandlers[action]()
          })
          if (result === "exit") {
            exit = true
          }
          break
        }
        case "profiles": {
          const result = await runSubmenu("Profiles", profileOptions, async (action) => {
            await actionHandlers[action]()
          })
          if (result === "exit") {
            exit = true
          }
          break
        }
        case "history-safety": {
          const result = await runSubmenu("History & Safety", historyOptions, async (action) => {
            await actionHandlers[action]()
          })
          if (result === "exit") {
            exit = true
          }
          break
        }
        case "io": {
          const result = await runSubmenu("Import / Export", ioOptions, async (action) => {
            await actionHandlers[action]()
          })
          if (result === "exit") {
            exit = true
          }
          break
        }
        case "cache": {
          const result = await runSubmenu("Cache & Models", cacheOptions, async (action) => {
            await actionHandlers[action]()
          })
          if (result === "exit") {
            exit = true
          }
          break
        }
        case "help":
          await showHelpCommand()
          await waitForEnter()
          break
        case "exit":
          exit = true
          break
      }
    } catch (error) {
      printLine(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`))
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
