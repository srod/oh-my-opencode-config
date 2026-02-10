#!/usr/bin/env bun

import { fileURLToPath } from "node:url"
import { z } from "zod"
import { atomicWrite } from "#utils/fs.js"
import { printError, printLine, printSuccess } from "#utils/output.js"

const PACKAGE_JSON_PATH = fileURLToPath(new URL("../../package.json", import.meta.url))
const CLI_VERSION_FILE_PATH = fileURLToPath(new URL("../cli/version.ts", import.meta.url))
const SAFE_PACKAGE_VERSION_RE = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/u

const PackageJsonVersionSchema = z.object({
  version: z.string().trim().regex(SAFE_PACKAGE_VERSION_RE),
})

export interface SyncCliVersionOptions {
  packageJsonPath?: string
  versionFilePath?: string
}

export interface SyncCliVersionResult {
  updated: boolean
  version: string
}

/**
 * Build the TypeScript file content that exports the CLI_VERSION constant set to the provided version.
 *
 * @param version - The semantic version string to embed as `CLI_VERSION`
 * @returns The file text: a single-line `export const CLI_VERSION = "<version>"` followed by a newline
 */
function buildVersionFileContent(version: string): string {
  return `export const CLI_VERSION = "${version}"\n`
}

/**
 * Extracts and validates the `version` field from a package.json string.
 *
 * @param rawPackageJson - The raw JSON text of a package.json file
 * @returns The validated `version` string from the package.json
 * @throws Error if the JSON is invalid or the `version` field is missing or does not match the expected format
 */
function parsePackageVersion(rawPackageJson: string): string {
  let parsed: unknown

  try {
    parsed = JSON.parse(rawPackageJson)
  } catch {
    throw new Error("package.json version is missing or invalid")
  }

  const result = PackageJsonVersionSchema.safeParse(parsed)
  if (!result.success) {
    throw new Error("package.json version is missing or invalid")
  }

  return result.data.version
}

/**
 * Read the text contents of the specified version file, or return an empty string if the file does not exist.
 *
 * @param filePath - Path to the version file to read
 * @returns The file contents as a string, or an empty string when the file is missing
 */
async function readVersionFile(filePath: string): Promise<string> {
  const file = Bun.file(filePath)
  if (!(await file.exists())) {
    return ""
  }
  return file.text()
}

/**
 * Syncs the CLI version file with the `version` field from package.json.
 *
 * @param options - Optional overrides for file paths.
 *   - `packageJsonPath`: Path to package.json (defaults to the repository package.json).
 *   - `versionFilePath`: Path to the target version file to write (defaults to the CLI version file path).
 * @returns An object with `updated`: `true` if the version file was written because its content changed, `false` if it was already up to date; and `version`: the synchronized version string.
 * @throws If package.json is missing or contains an invalid or missing `version`, or if file system operations fail.
 */
export async function syncCliVersion(
  options: SyncCliVersionOptions = {},
): Promise<SyncCliVersionResult> {
  const packageJsonPath = options.packageJsonPath ?? PACKAGE_JSON_PATH
  const versionFilePath = options.versionFilePath ?? CLI_VERSION_FILE_PATH

  const packageJsonText = await Bun.file(packageJsonPath).text()
  const version = parsePackageVersion(packageJsonText)
  const nextVersionFile = buildVersionFileContent(version)
  const currentVersionFile = await readVersionFile(versionFilePath)

  if (currentVersionFile === nextVersionFile) {
    return { updated: false, version }
  }

  await atomicWrite(versionFilePath, nextVersionFile)
  return { updated: true, version }
}

/**
 * Synchronizes the repository CLI version file with package.json and prints the result.
 *
 * Prints a success message when the version file was updated, or an informational line when it was already up to date.
 */
async function run(): Promise<void> {
  const result = await syncCliVersion()
  if (result.updated) {
    printSuccess(`Synced CLI version to ${result.version}.`)
    return
  }
  printLine(`CLI version already up to date (${result.version}).`)
}

if (import.meta.main) {
  run().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error)
    printError(message)
    process.exitCode = 1
  })
}
