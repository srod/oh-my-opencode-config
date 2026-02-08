#!/usr/bin/env bun

import { fileURLToPath } from "node:url"
import chalk from "chalk"
import { z } from "zod"
import { DEFAULT_CONFIG } from "#config/defaults.js"
import {
  applyAgentDefaultsToDefaultsFile,
  buildExpectedAgentDefaults,
  diffAgentDefaults,
  parseUpstreamAgentRequirements,
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

async function fetchUpstreamRequirements(tag: string): Promise<string> {
  const url = `${RAW_BASE_URL}/${tag}/src/shared/model-requirements.ts`
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to fetch upstream model requirements for ${tag}`)
  }
  return response.text()
}

function formatConfig(config: { model: string; variant?: string }): string {
  if (config.variant === undefined) {
    return config.model
  }
  return `${config.model} [${config.variant}]`
}

async function run(): Promise<void> {
  const { mode, dryRun } = parseMode(Bun.argv.slice(2))

  printLine(chalk.dim("Fetching latest oh-my-opencode release..."))
  const latestRelease = await fetchLatestRelease()
  const tag = latestRelease.tag_name

  printLine(chalk.dim(`Fetching upstream requirements from ${tag}...`))
  const source = await fetchUpstreamRequirements(tag)
  const upstreamAgents = parseUpstreamAgentRequirements(source)
  const upstreamCount = Object.keys(upstreamAgents).length
  if (upstreamCount === 0) {
    throw new Error("Parsed zero agent requirements from upstream source")
  }

  const currentAgents = DEFAULT_CONFIG.agents
  if (currentAgents === undefined) {
    throw new Error("DEFAULT_CONFIG.agents is missing")
  }

  const expectedAgents = buildExpectedAgentDefaults(currentAgents, upstreamAgents)
  const diffs = diffAgentDefaults(currentAgents, expectedAgents)

  const currentFile = await Bun.file(DEFAULTS_FILE_PATH).text()
  const nextFile = applyAgentDefaultsToDefaultsFile(currentFile, expectedAgents, tag, new Date())
  const isAlreadySynced = currentFile === nextFile

  if (mode === "check") {
    if (isAlreadySynced) {
      printSuccess(`Agent defaults are in sync with upstream ${tag}.`)
      return
    }

    printError(`Agent defaults drift detected vs upstream ${tag}.`)
    if (diffs.length > 0) {
      for (const diff of diffs) {
        printLine(
          `  ${chalk.yellow("•")} ${chalk.bold(diff.agent)}: ${chalk.dim(formatConfig(diff.current))} ${chalk.gray("->")} ${formatConfig(diff.expected)}`,
        )
      }
    } else {
      printLine(
        `  ${chalk.yellow("•")} Agent models match, but sync metadata in defaults.ts is stale.`,
      )
    }

    process.exitCode = 1
    return
  }

  if (isAlreadySynced) {
    printSuccess(`Agent defaults already in sync with upstream ${tag}.`)
    return
  }

  if (dryRun) {
    printLine(chalk.yellow(`Dry run: would update ${DEFAULTS_FILE_PATH}`))
  } else {
    await atomicWrite(DEFAULTS_FILE_PATH, nextFile)
    printSuccess(`Updated agent defaults from upstream ${tag}.`)
  }

  if (diffs.length > 0) {
    printLine(chalk.dim(`Updated ${diffs.length} agent default${diffs.length === 1 ? "" : "s"}:`))
    for (const diff of diffs) {
      printLine(
        `  ${chalk.yellow("•")} ${chalk.bold(diff.agent)}: ${chalk.dim(formatConfig(diff.current))} ${chalk.gray("->")} ${formatConfig(diff.expected)}`,
      )
    }
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
