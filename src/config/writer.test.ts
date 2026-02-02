import { afterEach, beforeEach, describe, expect, it } from "bun:test"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { saveConfig } from "./writer.js"

describe("saveConfig", () => {
  let tempDir: string
  let configPath: string

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "opencode-test-"))
    configPath = path.join(tempDir, "nested/dir/config.json")
  })

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true })
  })

  it("should save config and create directories if they do not exist", async () => {
    const config = {
      agents: {
        oracle: { model: "gpt-4" },
      },
    }

    await saveConfig({ filePath: configPath, config })

    const exists = await fs
      .stat(configPath)
      .then(() => true)
      .catch(() => false)
    expect(exists).toBe(true)

    const content = await fs.readFile(configPath, "utf8")
    const parsed = JSON.parse(content)
    expect(parsed.agents.oracle.model).toBe("gpt-4")
  })

  it("should write atomically (not leave partial files if interrupted - simulated)", async () => {
    const config = { agents: {} }
    await saveConfig({ filePath: configPath, config })

    const tmpPath = `${configPath}.tmp`
    const tmpExists = await fs
      .stat(tmpPath)
      .then(() => true)
      .catch(() => false)
    expect(tmpExists).toBe(false)
  })

  it("should throw ConcurrentModificationError if mtime is newer than expected", async () => {
    const config = { agents: {} }
    await saveConfig({ filePath: configPath, config })

    const stats = await fs.stat(configPath)
    const mtime = stats.mtime.getTime()

    await expect(
      saveConfig({ filePath: configPath, config, expectedMtime: mtime - 1000 }),
    ).rejects.toThrow("Concurrent modification detected")
  })

  it("should succeed if mtime is not newer than expected", async () => {
    const config = { agents: {} }
    await saveConfig({ filePath: configPath, config })

    const stats = await fs.stat(configPath)
    const mtime = stats.mtime.getTime()

    await expect(
      saveConfig({ filePath: configPath, config, expectedMtime: mtime }),
    ).resolves.toBeUndefined()
  })
})
