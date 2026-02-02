import fs from "node:fs/promises"
import { ConcurrentModificationError } from "../errors/types.js"
import type { Config } from "../types/config.js"
import { atomicWrite, handleFileError } from "../utils/fs.js"

export interface SaveConfigOptions {
  filePath: string
  config: Config
  expectedMtime?: number
}

export async function saveConfig(options: SaveConfigOptions): Promise<void> {
  const { filePath, config, expectedMtime } = options

  if (expectedMtime) {
    try {
      const stats = await fs.stat(filePath)
      if (stats.mtime.getTime() > expectedMtime) {
        throw new ConcurrentModificationError(filePath)
      }
    } catch (error) {
      if (error instanceof ConcurrentModificationError) throw error
    }
  }

  const content = JSON.stringify(config, null, 2)

  try {
    await atomicWrite(filePath, content)
  } catch (error) {
    handleFileError(error, filePath, "write")
  }
}
