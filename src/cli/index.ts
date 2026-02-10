import { Command } from "commander"
import { backupListCommand, backupRestoreCommand } from "#cli/commands/backup.js"
import { clearCacheCommand } from "#cli/commands/clear-cache.js"
import { configureAgentsCommand, configureCategoriesCommand } from "#cli/commands/configure.js"
import { diffCommand } from "#cli/commands/diff.js"
import { doctorCommand } from "#cli/commands/doctor.js"
import { exportCommand } from "#cli/commands/export.js"
import { historyCommand } from "#cli/commands/history.js"
import { importCommand } from "#cli/commands/import.js"
import { listCommand } from "#cli/commands/list.js"
import { mainMenuCommand } from "#cli/commands/menu/index.js"
import {
  profileDeleteCommand,
  profileListCommand,
  profileRenameCommand,
  profileSaveCommand,
  profileTemplateCommand,
  profileUseCommand,
} from "#cli/commands/profile.js"
import { quickSetupCommand } from "#cli/commands/quick-setup.js"
import { refreshCommand } from "#cli/commands/refresh.js"
import { resetCommand } from "#cli/commands/reset.js"
import { statusCommand } from "#cli/commands/status.js"
import { undoCommand } from "#cli/commands/undo.js"
import { CLI_VERSION } from "#cli/version.js"
import { maybeNotifyCliUpdate } from "#update/notifier.js"

export const program = new Command()

program
  .name("oh-my-opencode-config")
  .description("Interactive CLI for managing model assignments in oh-my-opencode.json")
  .version(CLI_VERSION)

program
  .option("--config <path>", "Override oh-my-opencode.json path")
  .option("--opencode-config <path>", "Override opencode.json path (for custom models)")
  .option("--refresh", "Force refresh of model cache from opencode")
  .option("--json", "Output as JSON")
  .option("--verbose", "Detailed logging")
  .option("--dry-run", "Preview without applying")
  .option("--template <path>", "Override profile template path")
  .option("--no-update-notifier", "Disable automatic CLI update notifications")

let pendingUpdateRefresh: Promise<void> | null = null

program.hook("preAction", async () => {
  const options = program.opts()
  const result = await maybeNotifyCliUpdate(options)
  pendingUpdateRefresh = result.pendingRefresh
})

program.hook("postAction", async () => {
  if (pendingUpdateRefresh) {
    await pendingUpdateRefresh
    pendingUpdateRefresh = null
  }
})

program
  .command("list")
  .description("Show current config")
  .action(async () => {
    const options = program.opts()
    await listCommand(options)
  })

const configure = program.command("configure").description("Configure models")

configure
  .command("agents")
  .description("Interactive agent model assignment")
  .action(async () => {
    const options = program.opts()
    await configureAgentsCommand(options)
  })

configure
  .command("categories")
  .description("Interactive category model assignment")
  .action(async () => {
    const options = program.opts()
    await configureCategoriesCommand(options)
  })

configure
  .command("quick-setup")
  .description("Apply preset configurations (Standard, Economy)")
  .action(async () => {
    const options = program.opts()
    await quickSetupCommand(options)
  })

program
  .command("reset")
  .description("Reset to defaults (with confirmation)")
  .action(async () => {
    const options = program.opts()
    await resetCommand(options)
  })

const backup = program.command("backup").description("Manage backups")

backup
  .command("list")
  .description("List available backups")
  .action(async () => {
    const options = program.opts()
    await backupListCommand(options)
  })

backup
  .command("restore <timestamp>")
  .description("Restore specific backup")
  .action(async (timestamp) => {
    const options = program.opts()
    await backupRestoreCommand(timestamp, options)
  })

const profile = program.command("profile").description("Manage configuration profiles")

profile
  .command("save [name]")
  .description("Save current config as named profile")
  .action(async (name) => {
    const options = program.opts()
    await profileSaveCommand(options, name)
  })

profile
  .command("use [name]")
  .description("Switch to named profile")
  .action(async (name) => {
    const options = program.opts()
    await profileUseCommand(options, name)
  })

profile
  .command("list")
  .description("List available profiles")
  .action(async () => {
    const options = program.opts()
    await profileListCommand(options)
  })

profile
  .command("delete [name]")
  .description("Delete a profile")
  .action(async (name) => {
    const options = program.opts()
    await profileDeleteCommand(options, name)
  })

profile
  .command("rename [old] [new]")
  .description("Rename a profile")
  .action(async (oldName, newName) => {
    const options = program.opts()
    await profileRenameCommand(options, oldName, newName)
  })

profile
  .command("template")
  .description("Create or update the profile template file")
  .action(async () => {
    const options = program.opts()
    await profileTemplateCommand(options)
  })

program
  .command("diff")
  .description("Show differences from defaults")
  .action(async () => {
    const options = program.opts()
    await diffCommand(options)
  })

program
  .command("refresh")
  .description("Refresh available models cache from opencode")
  .action(async () => {
    await refreshCommand()
  })

program
  .command("clear-cache")
  .description("Clear available models cache")
  .action(async () => {
    await clearCacheCommand()
  })

program
  .command("status")
  .description("Show configuration status with visual indicators")
  .action(async () => {
    const options = program.opts()
    await statusCommand(options)
  })

program
  .command("menu")
  .description("Interactive main menu")
  .action(async () => {
    const options = program.opts()
    await mainMenuCommand(options)
  })

program
  .command("doctor")
  .description("Diagnose configuration issues and suggest fixes")
  .option("--fix", "Auto-fix cache issues if possible")
  .action(async () => {
    const options = program.opts()
    await doctorCommand(options)
  })

program
  .command("import [path]")
  .description("Import configuration from JSON file")
  .action(async (inputPath) => {
    const options = program.opts()
    await importCommand(inputPath, options)
  })

program
  .command("export [path]")
  .description("Export configuration to JSON file")
  .action(async (outputPath) => {
    const options = program.opts()
    await exportCommand(outputPath, options)
  })

program
  .command("undo")
  .description("Undo last change by restoring most recent backup")
  .action(async () => {
    const options = program.opts()
    await undoCommand(options)
  })

program
  .command("history")
  .description("Show configuration change history")
  .option("--limit <number>", "Limit to N most recent changes", parseInt)
  .action(async () => {
    const options = program.opts()
    await historyCommand(options)
  })

program.action(async () => {
  const options = program.opts()
  await mainMenuCommand(options)
})

export async function run() {
  await program.parseAsync(process.argv)
}
