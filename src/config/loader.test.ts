import { afterEach, beforeEach, describe, expect, it } from "bun:test"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { DEFAULT_CONFIG } from "./defaults.js"
import { loadConfig } from "./loader.js"

describe("loadConfig", () => {
  let tempDir: string
  let configPath: string

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "opencode-test-"))
    configPath = path.join(tempDir, "config.json")
  })

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true })
  })

  it("should return default config if file does not exist", async () => {
    const config = await loadConfig(configPath)
    expect(config).toEqual(DEFAULT_CONFIG)
  })

  it("should load and validate a valid config file", async () => {
    const validConfig = {
      agents: {
        oracle: { model: "gpt-4" },
      },
    }
    await Bun.write(configPath, JSON.stringify(validConfig))

    const config = await loadConfig(configPath)
    expect(config.agents?.oracle.model).toBe("gpt-4")
  })

  it("should throw error for malformed JSON", async () => {
    await Bun.write(configPath, "{ invalid json }")

    expect(loadConfig(configPath)).rejects.toThrow(/Malformed JSON/)
  })

  it("should throw error for invalid config structure", async () => {
    const invalidConfig = {
      agents: {
        oracle: { model: 123 },
      },
    }
    await Bun.write(configPath, JSON.stringify(invalidConfig))

    expect(loadConfig(configPath)).rejects.toThrow(/Invalid configuration/)
  })
})
