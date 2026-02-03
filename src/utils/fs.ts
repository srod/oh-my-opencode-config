import fs from "node:fs/promises"
import path from "node:path"
import { PermissionDeniedError } from "#errors/types.js"

export async function fileExists(filePath: string): Promise<boolean> {
  return fs
    .access(filePath)
    .then(() => true)
    .catch(() => false)
}

export async function atomicWrite(filePath: string, content: string): Promise<void> {
  const tmpPath = `${filePath}.tmp`
  const dir = path.dirname(filePath)

  try {
    await fs.mkdir(dir, { recursive: true })
    await Bun.write(tmpPath, content)
    await fs.rename(tmpPath, filePath)
  } catch (error) {
    try {
      await fs.unlink(tmpPath)
    } catch {}

    handleFileError(error, filePath, "write")
  }
}

export function isErrnoException(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error
}

export async function getFileMtime(filePath: string): Promise<number | undefined> {
  const stats = await fs.stat(filePath).catch(() => null)
  return stats?.mtime.getTime()
}

export function handleFileError(error: unknown, filePath: string, operation: string): never {
  if (isErrnoException(error)) {
    if (error.code === "EACCES" || error.code === "EPERM") {
      throw new PermissionDeniedError(filePath, operation)
    }
  }
  throw error
}
