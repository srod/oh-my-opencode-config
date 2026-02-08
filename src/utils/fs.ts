import fs from "node:fs/promises"
import path from "node:path"
import { PermissionDeniedError } from "#errors/types.js"

/**
 * Checks whether a filesystem entry exists and is accessible at the given path.
 *
 * @returns `true` if the path is accessible, `false` otherwise.
 */
export async function fileExists(filePath: string): Promise<boolean> {
  return fs
    .access(filePath)
    .then(() => true)
    .catch(() => false)
}

/**
 * Write `content` to `filePath` atomically by writing to a temporary file and replacing the target.
 *
 * Resolves symbolic links in `filePath` to determine the actual write target, creates parent directories as needed, writes data to a `.tmp` sibling file, and renames it into place. If an error occurs, any created temporary file is removed and file-related permission errors are converted to a `PermissionDeniedError`.
 *
 * @param filePath - Destination file path (may be a symlink; the ultimate write target will be resolved)
 * @param content - Data to write into the file
 */
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

/**
 * Resolve a target filesystem path suitable for writing by following symbolic links.
 *
 * Follows symbolic links starting from `filePath` up to 40 levels and returns the first path that is not a symbolic link,
 * or the last-resolved path if a path component does not exist.
 *
 * @param filePath - The initial path to resolve
 * @returns The resolved path that should be used for writing (a non-symlink path or the final non-existent path)
 * @throws Error when a symlink loop is detected while resolving `filePath`
 * @throws Error when more than 40 symlink levels are encountered while resolving `filePath`
 * @throws Any filesystem error encountered during resolution, except `ENOENT` which causes the current path to be returned
 */
async function resolveWritePath(filePath: string): Promise<string> {
  const seenPaths = new Set<string>()
  let currentPath = filePath

  for (let depth = 0; depth < 40; depth++) {
    try {
      const stats = await fs.lstat(currentPath)
      if (!stats.isSymbolicLink()) {
        return currentPath
      }

      const symlinkTarget = await fs.readlink(currentPath)
      const nextPath = path.isAbsolute(symlinkTarget)
        ? symlinkTarget
        : path.resolve(path.dirname(currentPath), symlinkTarget)

      if (seenPaths.has(nextPath)) {
        throw new Error(`Symlink loop detected while resolving write path for "${filePath}"`)
      }

      seenPaths.add(nextPath)
      currentPath = nextPath
    } catch (error) {
      if (isErrnoException(error) && error.code === "ENOENT") {
        return currentPath
      }
      throw error
    }
  }

  throw new Error(`Too many symlink levels while resolving write path for "${filePath}"`)
}

/**
 * Determines whether a value is an error object that carries a `code` property (commonly used for system errno).
 *
 * @param error - The value to test
 * @returns `true` if `error` is an `Error` object with a `code` property, `false` otherwise
 */
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
