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
  let tmpPath: string | null = null

  try {
    const writePath = await resolveWritePath(filePath)
    tmpPath = `${writePath}.tmp`
    const dir = path.dirname(writePath)

    await fs.mkdir(dir, { recursive: true })
    await Bun.write(tmpPath, content)
    await fs.rename(tmpPath, writePath)
  } catch (error) {
    if (tmpPath) {
      try {
        await fs.unlink(tmpPath)
      } catch {}
    }

    handleFileError(error, filePath, "write")
  }
}

async function resolveWritePath(filePath: string): Promise<string> {
  try {
    const stats = await fs.lstat(filePath)
    if (!stats.isSymbolicLink()) {
      return filePath
    }

    const symlinkTarget = await fs.readlink(filePath)
    return path.isAbsolute(symlinkTarget)
      ? symlinkTarget
      : path.resolve(path.dirname(filePath), symlinkTarget)
  } catch (error) {
    if (isErrnoException(error) && error.code === "ENOENT") {
      return filePath
    }
    throw error
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
