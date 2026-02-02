import { afterEach, beforeEach, describe, expect, it } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import { cleanupOldBackups, createBackup, listBackups, restoreBackup } from "./manager.js"

describe("Backup Manager", () => {
  const testDir = path.join(process.cwd(), "test-backups")
  const configPath = path.join(testDir, "oh-my-opencode.json")

  beforeEach(async () => {
    await fs.mkdir(testDir, { recursive: true })
    await Bun.write(configPath, JSON.stringify({ version: 1 }))
  })

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true })
  })

  it("creates a backup with correct format", async () => {
    const backupPath = await createBackup(configPath)
    expect(backupPath).toMatch(/oh-my-opencode\.json\.backup\.\d{8}-\d{6}$/)
    expect(await Bun.file(backupPath).exists()).toBe(true)
  })

  it("lists backups sorted by timestamp descending", async () => {
    const timestamps = ["20260131-232059", "20260131-232058", "20260131-232057"]
    for (const ts of timestamps) {
      await Bun.write(`${configPath}.backup.${ts}`, "dummy")
    }

    const backups = await listBackups(configPath)
    expect(backups).toHaveLength(3)
    expect(backups[0].timestamp).toBe("20260131-232059")
    expect(backups[1].timestamp).toBe("20260131-232058")
    expect(backups[2].timestamp).toBe("20260131-232057")
  })

  it("restores from a backup", async () => {
    const ts = "20260131-232059"
    const backupPath = `${configPath}.backup.${ts}`
    const backupContent = JSON.stringify({ version: 2 })
    await Bun.write(backupPath, backupContent)

    await restoreBackup(configPath, ts)

    const restoredContent = await Bun.file(configPath).text()
    expect(restoredContent).toBe(backupContent)
  })

  it("cleans up old backups", async () => {
    const count = 15
    for (let i = 0; i < count; i++) {
      const ts = `20260131-0000${i.toString().padStart(2, "0")}`
      await Bun.write(`${configPath}.backup.${ts}`, "dummy")
    }

    await cleanupOldBackups(configPath, 10)

    const backups = await listBackups(configPath)
    expect(backups).toHaveLength(10)
    expect(backups[0].timestamp).toBe("20260131-000014")
    expect(backups[9].timestamp).toBe("20260131-000005")
  })

  it("throws error when backing up non-existent file", async () => {
    const nonExistent = path.join(testDir, "nope.json")
    await expect(createBackup(nonExistent)).rejects.toThrow()
  })

  it("throws error when restoring non-existent backup", async () => {
    await expect(restoreBackup(configPath, "99999999-999999")).rejects.toThrow()
  })
})
