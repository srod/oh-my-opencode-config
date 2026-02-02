import { stat } from "node:fs/promises"
import { confirm, isCancel, log } from "@clack/prompts"
import chalk from "chalk"
import { execa } from "execa"
import { isErrnoException } from "../utils/fs.js"
import { printError } from "../utils/output.js"
import {
  CacheCorruptedError,
  CacheExpiredError,
  CacheMissingError,
  ConcurrentModificationError,
  GracefulExitError,
  InvalidConfigError,
  PermissionDeniedError,
} from "./types.js"

export interface HandleErrorOptions {
  verbose?: boolean
}

export async function handleError(error: unknown, options?: HandleErrorOptions): Promise<void> {
  const { verbose = false } = options ?? {}

  if (isCancel(error) || error instanceof GracefulExitError) {
    log.info(chalk.yellow("Operation cancelled."))
    process.exit(0)
  }

  if (error instanceof CacheMissingError) {
    log.error(chalk.red(error.message))
    await offerCacheRefresh()
    return
  }

  if (error instanceof CacheCorruptedError) {
    log.error(chalk.red(error.message))
    log.info(`Try running ${chalk.cyan("opencode models --refresh")} to fix the cache.`)
    process.exit(1)
  }

  if (error instanceof PermissionDeniedError) {
    log.error(chalk.red(error.message))
    log.info(`Check file permissions or try running with ${chalk.cyan("sudo")}.`)
    process.exit(1)
  }

  if (error instanceof ConcurrentModificationError) {
    log.error(chalk.red(error.message))
    log.info("The configuration was modified by another process. Please try again.")
    process.exit(1)
  }

  if (error instanceof InvalidConfigError) {
    log.error(chalk.red(error.message))
    process.exit(1)
  }

  if (error instanceof CacheExpiredError) {
    log.warn(chalk.yellow(error.message))
    await offerCacheRefresh()
    return
  }

  const message = error instanceof Error ? error.message : String(error)
  log.error(chalk.red(`An unexpected error occurred: ${message}`))

  if (verbose && error instanceof Error && error.stack) {
    printError(chalk.dim(error.stack))
  } else {
    log.info(`Run with ${chalk.cyan("--verbose")} for more details.`)
  }

  process.exit(1)
}

export async function offerCacheRefresh(): Promise<void> {
  const proceed = await confirm({
    message: "Would you like to refresh the models cache now?",
    initialValue: true,
  })

  if (isCancel(proceed) || !proceed) {
    return
  }

  try {
    log.step("Refreshing models cache...")
    await execa("opencode", ["models", "--refresh"])
    log.success("Cache refreshed successfully.")
  } catch (error) {
    log.error(
      chalk.red(
        "Failed to refresh cache. Please run " +
          chalk.cyan("opencode models --refresh") +
          " manually.",
      ),
    )
    if (error instanceof Error) {
      log.info(chalk.dim(error.message))
    }
  }
}

export async function validateCacheAge(cachePath: string): Promise<void> {
  try {
    const stats = await stat(cachePath)
    const ageInDays = (Date.now() - stats.mtime.getTime()) / (1000 * 60 * 60 * 24)

    if (ageInDays > 7) {
      log.warn(chalk.yellow(`Models cache is ${ageInDays.toFixed(1)} days old. Data may be stale.`))
      const refresh = await confirm({
        message: "Would you like to refresh it now?",
        initialValue: false,
      })

      if (!isCancel(refresh) && refresh) {
        await offerCacheRefresh()
      }
    }
  } catch (error) {
    if (isErrnoException(error) && error.code !== "ENOENT") {
      log.error(chalk.red(`Failed to check cache age: ${error.message}`))
    }
  }
}
