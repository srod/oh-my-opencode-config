/**
 * Base command options shared across all CLI commands.
 * Commands can use the full interface or pick specific options.
 */
export interface BaseCommandOptions {
  config?: string
  opencodeConfig?: string
  json?: boolean
  verbose?: boolean
  dryRun?: boolean
  refresh?: boolean
  template?: string
  updateNotifier?: boolean
}
