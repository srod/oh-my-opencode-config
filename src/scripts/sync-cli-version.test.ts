import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { syncCliVersion } from "./sync-cli-version.js"

describe("syncCliVersion", () => {
  let tmpDir: string
  let packageJsonPath: string
  let versionFilePath: string

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "sync-cli-version-test-"))
    packageJsonPath = path.join(tmpDir, "package.json")
    versionFilePath = path.join(tmpDir, "src", "cli", "version.ts")
  })

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true })
  })

  test("writes version.ts from package.json version", async () => {
    await Bun.write(packageJsonPath, JSON.stringify({ name: "example", version: "1.2.3" }))

    const result = await syncCliVersion({ packageJsonPath, versionFilePath })
    const content = await Bun.file(versionFilePath).text()

    expect(result).toEqual({ updated: true, version: "1.2.3" })
    expect(content).toBe('export const CLI_VERSION = "1.2.3"\n')
  })

  test("does not rewrite when version.ts is already up to date", async () => {
    await Bun.write(packageJsonPath, JSON.stringify({ name: "example", version: "2.0.0" }))
    await Bun.write(versionFilePath, 'export const CLI_VERSION = "2.0.0"\n')

    const result = await syncCliVersion({ packageJsonPath, versionFilePath })
    const content = await Bun.file(versionFilePath).text()

    expect(result).toEqual({ updated: false, version: "2.0.0" })
    expect(content).toBe('export const CLI_VERSION = "2.0.0"\n')
  })

  test("throws when package.json version is missing or invalid", async () => {
    await Bun.write(packageJsonPath, JSON.stringify({ name: "example" }))

    await expect(syncCliVersion({ packageJsonPath, versionFilePath })).rejects.toThrow(
      "package.json version is missing or invalid",
    )
  })
})
