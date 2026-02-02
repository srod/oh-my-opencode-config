import { Command } from "commander"
import { backupListCommand, backupRestoreCommand } from "./commands/backup.js"
import { clearCacheCommand } from "./commands/clear-cache.js"
import { configureAgentsCommand, configureCategoriesCommand } from "./commands/configure.js"
import { diffCommand } from "./commands/diff.js"
import { doctorCommand } from "./commands/doctor.js"
import { exportCommand } from "./commands/export.js"
import { historyCommand } from "./commands/history.js"
import { importCommand } from "./commands/import.js"
import { listCommand } from "./commands/list.js"
import { mainMenuCommand } from "./commands/menu.js"
import {
  profileDeleteCommand,
  profileListCommand,
  profileRenameCommand,
  profileSaveCommand,
  profileUseCommand,
} from "./commands/profile.js"
import { quickSetupCommand } from "./commands/quick-setup.js"
import { refreshCommand } from "./commands/refresh.js"
import { resetCommand } from "./commands/reset.js"
import { statusCommand } from "./commands/status.js"
import { undoCommand } from "./commands/undo.js"

export const program = new Command()

program
  .name("oh-my-opencode-config")
  .description("Interactive CLI for managing model assignments in oh-my-opencode.json")
  .version("0.1.0")

program
  .option("--config <path>", "Override oh-my-opencode.json path")
  .option("--opencode-config <path>", "Override opencode.json path (for custom models)")
  .option("--refresh", "Force refresh of model cache from opencode")
  .option("--json", "Output as JSON")
  .option("--verbose", "Detailed logging")
  .option("--dry-run", "Preview without applying")

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

export async function run() {
  await program.parseAsync(process.argv)
}
