import chalk from "chalk"
import { z } from "zod"
import type { BaseCommandOptions } from "#cli/types.js"
import { CLI_VERSION } from "#cli/version.js"
import { UPDATE_NOTIFIER_CACHE_PATH, UPDATE_NOTIFIER_CACHE_TTL_MS } from "#config/paths.js"
import { atomicWrite } from "#utils/fs.js"
import type { NpmUpdateStatus } from "#utils/npm.js"
import { checkSingleNpmUpdate } from "#utils/npm.js"
import { printLine } from "#utils/output.js"

const UPDATE_PACKAGE_NAME = "oh-my-opencode-config"

const UpdateNotifierCacheSchema = z.object({
  checkedAt: z.number(),
  currentVersion: z.string(),
  latest: z.string().nullable(),
  updateAvailable: z.boolean().nullable(),
  error: z.string().nullable(),
  notifiedVersion: z.string().nullable(),
})

type UpdateNotifierCache = z.infer<typeof UpdateNotifierCacheSchema>

interface NotifierOverrides {
  cachePath?: string
  cacheTtlMs?: number
  cliVersion?: string
  checkUpdate?: (packageName: string, currentVersion: string | null) => Promise<NpmUpdateStatus>
  now?: () => number
  print?: (text: string) => void
}

export interface UpdateNotifierResult {
  pendingRefresh: Promise<void> | null
}

function isTruthyEnvValue(value: string | undefined): boolean {
  if (!value) {
    return false
  }
  const normalized = value.trim().toLowerCase()
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on"
}

function shouldSkipUpdateNotifier(
  options: Pick<BaseCommandOptions, "json" | "updateNotifier">,
): boolean {
  if (options.json) {
    return true
  }
  if (options.updateNotifier === false) {
    return true
  }
  if (isTruthyEnvValue(process.env.OH_MY_OPENCODE_CONFIG_NO_UPDATE_NOTIFIER)) {
    return true
  }
  if (isTruthyEnvValue(process.env.CI)) {
    return true
  }
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    return true
  }
  return false
}

function isFreshCache(cache: UpdateNotifierCache, now: () => number, cacheTtlMs: number): boolean {
  const age = now() - cache.checkedAt
  return age >= 0 && age < cacheTtlMs
}

async function readCachedStatus(cachePath: string): Promise<UpdateNotifierCache | null> {
  const file = Bun.file(cachePath)
  if (!(await file.exists())) {
    return null
  }

  try {
    const raw = await file.text()
    const parsed: unknown = JSON.parse(raw)
    const result = UpdateNotifierCacheSchema.safeParse(parsed)
    if (!result.success) {
      return null
    }
    return result.data
  } catch {
    return null
  }
}

async function writeCachedStatus(cachePath: string, status: UpdateNotifierCache): Promise<void> {
  await atomicWrite(cachePath, JSON.stringify(status))
}

function shouldNotify(
  status: UpdateNotifierCache,
): status is UpdateNotifierCache & { latest: string } {
  return (
    status.updateAvailable === true &&
    status.latest !== null &&
    status.latest.length > 0 &&
    status.notifiedVersion !== status.latest
  )
}

function printUpdateAvailable(
  print: (text: string) => void,
  currentVersion: string,
  latest: string,
): void {
  print(chalk.yellow("┏━ 🚀 Update Available ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"))
  print(
    chalk.yellow(
      `┃ ${chalk.bold(UPDATE_PACKAGE_NAME)} ${chalk.dim(`${currentVersion} -> ${latest}`)}`,
    ),
  )
  print(chalk.yellow(`┃ ${chalk.cyan("Run:")} ${chalk.bold("npm i -g oh-my-opencode-config")}`))
  print(chalk.yellow(`┃ ${chalk.dim("or:")}  ${chalk.bold("bun add -g oh-my-opencode-config")}`))
  print(chalk.yellow("┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"))
}

async function refreshCacheInBackground(
  cachePath: string,
  cliVersion: string,
  checkUpdate: (packageName: string, currentVersion: string | null) => Promise<NpmUpdateStatus>,
  now: () => number,
  verbosePrint: ((text: string) => void) | null,
): Promise<void> {
  try {
    const nextStatus = await checkUpdate(UPDATE_PACKAGE_NAME, cliVersion)
    const status: UpdateNotifierCache = {
      checkedAt: now(),
      currentVersion: cliVersion,
      latest: nextStatus.latest,
      updateAvailable: nextStatus.updateAvailable,
      error: nextStatus.error,
      notifiedVersion: null,
    }
    await writeCachedStatus(cachePath, status)

    if (verbosePrint && nextStatus.error) {
      verbosePrint(chalk.dim(`Update notifier: ${nextStatus.error}`))
    }
  } catch (error) {
    if (!verbosePrint) {
      return
    }

    if (error instanceof Error) {
      const message = error.message.trim()
      verbosePrint(chalk.dim(`Update notifier: ${message.length > 0 ? message : "failed"}`))
      return
    }

    verbosePrint(chalk.dim("Update notifier: failed"))
  }
}

export async function maybeNotifyCliUpdate(
  options: Pick<BaseCommandOptions, "json" | "verbose" | "updateNotifier">,
  overrides?: NotifierOverrides,
): Promise<UpdateNotifierResult> {
  if (shouldSkipUpdateNotifier(options)) {
    return { pendingRefresh: null }
  }

  const cachePath = overrides?.cachePath ?? UPDATE_NOTIFIER_CACHE_PATH
  const cacheTtlMs = overrides?.cacheTtlMs ?? UPDATE_NOTIFIER_CACHE_TTL_MS
  const cliVersion = overrides?.cliVersion ?? CLI_VERSION
  const checkUpdate = overrides?.checkUpdate ?? checkSingleNpmUpdate
  const now = overrides?.now ?? Date.now
  const print = overrides?.print ?? printLine

  try {
    const cached = await readCachedStatus(cachePath)

    if (cached && isFreshCache(cached, now, cacheTtlMs) && cached.currentVersion === cliVersion) {
      if (shouldNotify(cached)) {
        printUpdateAvailable(print, cliVersion, cached.latest)
        await writeCachedStatus(cachePath, { ...cached, notifiedVersion: cached.latest })
      }
      return { pendingRefresh: null }
    }

    const verbosePrint = options.verbose ? print : null
    const pendingRefresh = refreshCacheInBackground(
      cachePath,
      cliVersion,
      checkUpdate,
      now,
      verbosePrint,
    )
    return { pendingRefresh }
  } catch {
    return { pendingRefresh: null }
  }
}
