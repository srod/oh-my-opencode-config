#!/usr/bin/env bun

import { fileURLToPath } from "node:url"
import chalk from "chalk"
import { z } from "zod"
import { DEFAULT_CONFIG } from "#config/defaults.js"
import type { AgentDefaultDiff, CategoryDefaultDiff } from "#config/upstream-agent-sync.js"
import {
  applyAgentDefaultsToDefaultsFile,
  buildExpectedAgentDefaults,
  buildExpectedCategoryDefaults,
  diffAgentDefaults,
  diffCategoryDefaults,
  parseUpstreamAgentRequirements,
  parseUpstreamCategoryRequirements,
} from "#config/upstream-agent-sync.js"
import { atomicWrite } from "#utils/fs.js"
import { printError, printLine, printSuccess } from "#utils/output.js"

const RELEASE_API_URL = "https://api.github.com/repos/code-yeongyu/oh-my-opencode/releases/latest"
const RAW_BASE_URL = "https://raw.githubusercontent.com/code-yeongyu/oh-my-opencode"
const DEFAULTS_FILE_PATH = fileURLToPath(new URL("../config/defaults.ts", import.meta.url))

const LatestReleaseSchema = z.object({
  tag_name: z.string().min(1),
  html_url: z.string().url().optional(),
})

type SyncMode = "check" | "apply"

type LatestRelease = z.infer<typeof LatestReleaseSchema>

/**
 * Build HTTP headers for requests to the GitHub API, adding an Authorization bearer token when present.
 *
 * @param env - Environment key/value map used to read `GITHUB_TOKEN`
 * @returns A map of HTTP headers including `Accept: application/vnd.github+json` and, if `GITHUB_TOKEN` is non-empty, `Authorization: Bearer <token>`
 */
export function getGitHubApiHeaders(env: {
  readonly [key: string]: string | undefined
}): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
  }

  const token = env.GITHUB_TOKEN?.trim()
  if (token !== undefined && token.length > 0) {
    headers.Authorization = `Bearer ${token}`
  }

  return headers
}

/**
 * Parse CLI arguments to determine the sync mode and whether the run is a dry run.
 *
 * @param args - The command-line arguments to parse (e.g., process.argv.slice(...))
 * @returns An object with `mode` set to `"check"` or `"apply"`, and `dryRun` set to `true` if `--dry-run` was provided, `false` otherwise.
 * @throws If neither or both `--check` and `--apply` are provided.
 * @throws If `--dry-run` is provided without `--apply`.
 */
function parseMode(args: string[]): { mode: SyncMode; dryRun: boolean } {
  const hasCheck = args.includes("--check")
  const hasApply = args.includes("--apply")
  const dryRun = args.includes("--dry-run")

  if (hasCheck === hasApply) {
    throw new Error("Use exactly one mode: --check or --apply")
  }

  if (dryRun && !hasApply) {
    throw new Error("--dry-run can only be used with --apply")
  }

  return {
    mode: hasApply ? "apply" : "check",
    dryRun,
  }
}

/**
 * Fetches the latest GitHub release for the repository and validates the response against the release schema.
 *
 * @returns The validated release object parsed by `LatestReleaseSchema`.
 * @throws Error if the GitHub API request returns a non-OK HTTP response.
 */
async function fetchLatestRelease(): Promise<LatestRelease> {
  const response = await fetch(RELEASE_API_URL, {
    headers: getGitHubApiHeaders(Bun.env),
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch latest release (${response.status} ${response.statusText})`)
  }

  const json = await response.json()
  return LatestReleaseSchema.parse(json)
}

/**
 * Retrieve the upstream model requirements source file for a given release tag.
 *
 * @param tag - The GitHub release tag (for example, `v1.2.3`) to fetch the file from
 * @returns The raw TypeScript source text of the upstream `model-requirements.ts` file
 * @throws Error if the HTTP request returns a non-OK response
 */
async function fetchUpstreamRequirements(tag: string): Promise<string> {
  const url = `${RAW_BASE_URL}/${tag}/src/shared/model-requirements.ts`
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to fetch upstream model requirements for ${tag}`)
  }
  return response.text()
}

/**
 * Format a model configuration into a single-line label.
 *
 * @param config - Object containing the model name and an optional variant
 * @returns The model name when `variant` is not provided, otherwise `model [variant]`
 */
function formatConfig(config: { model: string; variant?: string }): string {
  if (config.variant === undefined) {
    return config.model
  }
  return `${config.model} [${config.variant}]`
}

/**
 * Print diff lines for both agent and category defaults.
 *
 * @param agentDiffs - Differences between current and expected agent defaults
 * @param categoryDiffs - Differences between current and expected category defaults
 */
function printDiffLines(
  agentDiffs: AgentDefaultDiff[],
  categoryDiffs: CategoryDefaultDiff[],
): void {
  for (const diff of agentDiffs) {
    printLine(
      `  ${chalk.yellow("•")} ${chalk.bold(`[agent] ${diff.agent}`)}: ${chalk.dim(formatConfig(diff.current))} ${chalk.gray("->")} ${formatConfig(diff.expected)}`,
    )
  }
  for (const diff of categoryDiffs) {
    printLine(
      `  ${chalk.yellow("•")} ${chalk.bold(`[category] ${diff.category}`)}: ${chalk.dim(formatConfig(diff.current))} ${chalk.gray("->")} ${formatConfig(diff.expected)}`,
    )
  }
}

/**
 * Synchronizes local agent and category default configurations with upstream requirements.
 *
 * Performs a full sync workflow: determines CLI mode (`--check` or `--apply`), fetches the latest upstream release and requirements, computes expected defaults and diffs against the current defaults file, and either reports drift or updates the defaults file.
 *
 * Behavior details:
 * - In `--check` mode: prints sync status and per-agent/per-category diffs when drift is detected, and sets `process.exitCode = 1` on drift.
 * - In `--apply` mode: writes the updated defaults file unless `--dry-run` is specified (in which case it only prints what would change).
 * - Throws an Error if upstream parsing yields zero agents/categories or if corresponding defaults blocks are missing.
 *
 * Side effects:
 * - May write to the filesystem (updates DEFAULTS_FILE_PATH).
 * - Prints progress, diffs, and success/error messages to stdout/stderr.
 */
async function run(): Promise<void> {
  const { mode, dryRun } = parseMode(Bun.argv.slice(2))

  printLine(chalk.dim("Fetching latest oh-my-opencode release..."))
  const latestRelease = await fetchLatestRelease()
  const tag = latestRelease.tag_name

  printLine(chalk.dim(`Fetching upstream requirements from ${tag}...`))
  const source = await fetchUpstreamRequirements(tag)
  const upstreamAgents = parseUpstreamAgentRequirements(source)
  const upstreamCategories = parseUpstreamCategoryRequirements(source)
  if (Object.keys(upstreamAgents).length === 0) {
    throw new Error("Parsed zero agent requirements from upstream source")
  }
  if (Object.keys(upstreamCategories).length === 0) {
    throw new Error("Parsed zero category requirements from upstream source")
  }

  const currentAgents = DEFAULT_CONFIG.agents
  const currentCategories = DEFAULT_CONFIG.categories
  if (currentAgents === undefined) {
    throw new Error("DEFAULT_CONFIG.agents is missing")
  }
  if (currentCategories === undefined) {
    throw new Error("DEFAULT_CONFIG.categories is missing")
  }

  const expectedAgents = buildExpectedAgentDefaults(currentAgents, upstreamAgents)
  const expectedCategories = buildExpectedCategoryDefaults(currentCategories, upstreamCategories)
  const agentDiffs = diffAgentDefaults(currentAgents, expectedAgents)
  const categoryDiffs = diffCategoryDefaults(currentCategories, expectedCategories)
  const totalDiffs = agentDiffs.length + categoryDiffs.length

  const currentFile = await Bun.file(DEFAULTS_FILE_PATH).text()
  const nextFile = applyAgentDefaultsToDefaultsFile(
    currentFile,
    expectedAgents,
    tag,
    new Date(),
    expectedCategories,
  )
  const isAlreadySynced = currentFile === nextFile

  if (mode === "check") {
    if (isAlreadySynced) {
      printSuccess(`Agent and category defaults are in sync with upstream ${tag}.`)
      return
    }

    printError(`Defaults drift detected vs upstream ${tag}.`)
    if (totalDiffs > 0) {
      printDiffLines(agentDiffs, categoryDiffs)
    } else {
      printLine(`  ${chalk.yellow("•")} Defaults match, but sync metadata in defaults.ts is stale.`)
    }

    process.exitCode = 1
    return
  }

  if (isAlreadySynced) {
    printSuccess(`Agent and category defaults already in sync with upstream ${tag}.`)
    return
  }

  if (dryRun) {
    printLine(chalk.yellow(`Dry run: would update ${DEFAULTS_FILE_PATH}`))
  } else {
    await atomicWrite(DEFAULTS_FILE_PATH, nextFile)
    printSuccess(`Updated defaults from upstream ${tag}.`)
  }

  if (totalDiffs > 0) {
    printLine(chalk.dim(`Updated ${totalDiffs} default${totalDiffs === 1 ? "" : "s"}:`))
    printDiffLines(agentDiffs, categoryDiffs)
  } else {
    printLine(chalk.dim("Updated sync metadata only."))
  }
}

if (import.meta.main) {
  run().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error)
    printError(message)
    process.exitCode = 1
  })
}
