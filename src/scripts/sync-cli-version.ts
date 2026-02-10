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

function buildVersionFileContent(version: string): string {
  return `export const CLI_VERSION = "${version}"\n`
}

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

async function readVersionFile(filePath: string): Promise<string> {
  const file = Bun.file(filePath)
  if (!(await file.exists())) {
    return ""
  }
  return file.text()
}

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
