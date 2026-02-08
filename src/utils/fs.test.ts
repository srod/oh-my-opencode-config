import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { PermissionDeniedError } from "#errors/types.js"
import { atomicWrite, fileExists, getFileMtime, handleFileError, isErrnoException } from "./fs.js"

describe("fileExists", () => {
  let tmpDir: string

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "fs-test-"))
  })

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true })
  })

  test("returns true for existing file", async () => {
    const filePath = path.join(tmpDir, "exists.txt")
    await Bun.write(filePath, "hello")
    expect(await fileExists(filePath)).toBe(true)
  })

  test("returns false for non-existing file", async () => {
    const filePath = path.join(tmpDir, "nope.txt")
    expect(await fileExists(filePath)).toBe(false)
  })

  test("returns true for existing directory", async () => {
    expect(await fileExists(tmpDir)).toBe(true)
  })
})

describe("atomicWrite", () => {
  let tmpDir: string

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "fs-test-"))
  })

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true })
  })

  test("writes content to file", async () => {
    const filePath = path.join(tmpDir, "out.txt")
    await atomicWrite(filePath, "hello world")
    const content = await Bun.file(filePath).text()
    expect(content).toBe("hello world")
  })

  test("creates parent directories if needed", async () => {
    const filePath = path.join(tmpDir, "a", "b", "c", "out.txt")
    await atomicWrite(filePath, "nested")
    const content = await Bun.file(filePath).text()
    expect(content).toBe("nested")
  })

  test("overwrites existing file atomically", async () => {
    const filePath = path.join(tmpDir, "overwrite.txt")
    await atomicWrite(filePath, "first")
    await atomicWrite(filePath, "second")
    const content = await Bun.file(filePath).text()
    expect(content).toBe("second")
  })

  test("updates symlink target without replacing the symlink", async () => {
    const targetPath = path.join(tmpDir, "profile.json")
    const symlinkPath = path.join(tmpDir, "oh-my-opencode.json")

    await Bun.write(targetPath, '{"agents":{"oracle":{"model":"initial"}}}')
    await fs.symlink(targetPath, symlinkPath)

    await atomicWrite(symlinkPath, '{"agents":{"oracle":{"model":"updated"}}}')

    const symlinkStats = await fs.lstat(symlinkPath)
    expect(symlinkStats.isSymbolicLink()).toBe(true)

    const targetContent = await Bun.file(targetPath).text()
    expect(targetContent).toBe('{"agents":{"oracle":{"model":"updated"}}}')
  })

  test("follows nested symlinks and writes final target", async () => {
    const targetPath = path.join(tmpDir, "profile.json")
    const intermediateSymlinkPath = path.join(tmpDir, "profile-link.json")
    const symlinkPath = path.join(tmpDir, "oh-my-opencode.json")

    await Bun.write(targetPath, '{"agents":{"oracle":{"model":"initial"}}}')
    await fs.symlink(targetPath, intermediateSymlinkPath)
    await fs.symlink(intermediateSymlinkPath, symlinkPath)

    await atomicWrite(symlinkPath, '{"agents":{"oracle":{"model":"updated"}}}')

    const topLevelStats = await fs.lstat(symlinkPath)
    const intermediateStats = await fs.lstat(intermediateSymlinkPath)
    expect(topLevelStats.isSymbolicLink()).toBe(true)
    expect(intermediateStats.isSymbolicLink()).toBe(true)

    const targetContent = await Bun.file(targetPath).text()
    expect(targetContent).toBe('{"agents":{"oracle":{"model":"updated"}}}')
  })

  test("leaves no temp files after successful write", async () => {
    const filePath = path.join(tmpDir, "clean.txt")
    await atomicWrite(filePath, "content")
    const files = await fs.readdir(tmpDir)
    const tmpFiles = files.filter((f) => f.endsWith(".tmp"))
    expect(tmpFiles).toHaveLength(0)
  })

  test("throws PermissionDeniedError on EACCES", async () => {
    const readonlyDir = path.join(tmpDir, "readonly")
    await fs.mkdir(readonlyDir)
    const filePath = path.join(readonlyDir, "file.txt")
    await fs.chmod(readonlyDir, 0o444)

    try {
      await expect(atomicWrite(filePath, "fail")).rejects.toBeInstanceOf(PermissionDeniedError)
    } finally {
      await fs.chmod(readonlyDir, 0o755)
    }
  })
})

describe("isErrnoException", () => {
  test("returns true for Error with .code property", () => {
    const error = Object.assign(new Error("test"), { code: "EACCES" })
    expect(isErrnoException(error)).toBe(true)
  })

  test("returns false for plain Error without .code", () => {
    const error = new Error("test")
    expect(isErrnoException(error)).toBe(false)
  })

  test("returns false for string", () => {
    expect(isErrnoException("error")).toBe(false)
  })

  test("returns false for null", () => {
    expect(isErrnoException(null)).toBe(false)
  })

  test("returns false for undefined", () => {
    expect(isErrnoException(undefined)).toBe(false)
  })
})

describe("getFileMtime", () => {
  let tmpDir: string

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "fs-test-"))
  })

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true })
  })

  test("returns a number for an existing file", async () => {
    const filePath = path.join(tmpDir, "test.txt")
    await Bun.write(filePath, "content")
    const mtime = await getFileMtime(filePath)
    expect(typeof mtime).toBe("number")
    expect(mtime).toBeGreaterThan(0)
  })

  test("returns undefined for a non-existent file path", async () => {
    const filePath = path.join(tmpDir, "nonexistent.txt")
    const mtime = await getFileMtime(filePath)
    expect(mtime).toBeUndefined()
  })
})

describe("handleFileError", () => {
  test("wraps EACCES in PermissionDeniedError", () => {
    const error = Object.assign(new Error("EACCES"), { code: "EACCES" })
    expect(() => handleFileError(error, "/test/path", "write")).toThrow(PermissionDeniedError)
  })

  test("wraps EPERM in PermissionDeniedError", () => {
    const error = Object.assign(new Error("EPERM"), { code: "EPERM" })
    expect(() => handleFileError(error, "/test/path", "read")).toThrow(PermissionDeniedError)
  })

  test("re-throws non-permission errors", () => {
    const error = Object.assign(new Error("ENOENT"), { code: "ENOENT" })
    expect(() => handleFileError(error, "/test/path", "read")).toThrow("ENOENT")
  })

  test("re-throws non-Error objects", () => {
    expect(() => handleFileError("string error", "/test/path", "read")).toThrow("string error")
  })
})
