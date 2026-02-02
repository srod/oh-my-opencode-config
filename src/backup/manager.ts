import fs from "node:fs/promises"
import path from "node:path"
import { atomicWrite, isErrnoException } from "../utils/fs.js"

export interface BackupInfo {
  timestamp: string
  path: string
  created: Date
}

export async function createBackup(configPath: string): Promise<string> {
  const timestamp = new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\..+/, "")
    .replace("T", "-")
    .slice(0, 15)

  const backupPath = `${configPath}.backup.${timestamp}`

  const file = Bun.file(configPath)
  if (!(await file.exists())) {
    throw new Error(`Cannot backup non-existent config: ${configPath}`)
  }

  const content = await file.arrayBuffer()
  await Bun.write(backupPath, content)

  return backupPath
}

export async function listBackups(configPath: string): Promise<BackupInfo[]> {
  const dir = path.dirname(configPath)
  const baseName = path.basename(configPath)
  const backupPrefix = `${baseName}.backup.`

  try {
    const files = await fs.readdir(dir)
    const backups: BackupInfo[] = []

    for (const file of files) {
      if (file.startsWith(backupPrefix)) {
        const timestamp = file.slice(backupPrefix.length)
        const filePath = path.join(dir, file)
        const stats = await fs.stat(filePath)

        backups.push({
          timestamp,
          path: filePath,
          created: stats.birthtime || stats.mtime,
        })
      }
    }

    return backups.sort((a, b) => b.timestamp.localeCompare(a.timestamp))
  } catch (error) {
    if (isErrnoException(error) && error.code === "ENOENT") {
      return []
    }
    throw error
  }
}

export async function restoreBackup(configPath: string, timestamp: string): Promise<void> {
  const backupPath = `${configPath}.backup.${timestamp}`
  const backupFile = Bun.file(backupPath)

  if (!(await backupFile.exists())) {
    throw new Error(`Backup not found: ${backupPath}`)
  }

  const content = await backupFile.text()
  await atomicWrite(configPath, content)
}

export async function cleanupOldBackups(configPath: string, maxCount = 10): Promise<void> {
  const backups = await listBackups(configPath)

  if (backups.length <= maxCount) {
    return
  }

  const toDelete = backups.slice(maxCount)
  await Promise.all(toDelete.map((b) => fs.unlink(b.path)))
}
