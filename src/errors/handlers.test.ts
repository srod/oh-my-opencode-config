import { beforeEach, describe, expect, it, mock, spyOn } from "bun:test"
import { handleError, offerCacheRefresh, validateCacheAge } from "./handlers.js"
import {
  CacheCorruptedError,
  CacheExpiredError,
  CacheMissingError,
  ConcurrentModificationError,
  GracefulExitError,
  InvalidConfigError,
  PermissionDeniedError,
} from "./types.js"

const mockLog = {
  error: mock(() => {}),
  info: mock(() => {}),
  warn: mock(() => {}),
  success: mock(() => {}),
  step: mock(() => {}),
}

const mockConfirm = mock(async () => true)

mock.module("@clack/prompts", () => ({
  log: mockLog,
  confirm: mockConfirm,
  isCancel: (val: unknown) => val === Symbol.for("clack:cancel"),
}))

const mockExeca = mock(async () => ({}))
mock.module("execa", () => ({
  execa: mockExeca,
}))

const mockStat = mock(async () => ({ mtime: new Date() }))
mock.module("node:fs/promises", () => ({
  stat: mockStat,
}))

describe("Error Handlers", () => {
  const exitSpy = spyOn(process, "exit").mockImplementation(() => undefined as never)

  beforeEach(() => {
    mockLog.error.mockClear()
    mockLog.info.mockClear()
    mockLog.warn.mockClear()
    mockLog.success.mockClear()
    mockLog.step.mockClear()
    mockConfirm.mockClear()
    mockExeca.mockClear()
    mockStat.mockClear()
    exitSpy.mockClear()
  })

  describe("handleError", () => {
    it("should handle GracefulExitError", async () => {
      await handleError(new GracefulExitError())
      expect(mockLog.info).toHaveBeenCalled()
      expect(exitSpy).toHaveBeenCalledWith(0)
    })

    it("should handle CacheMissingError", async () => {
      mockConfirm.mockResolvedValue(false)
      await handleError(new CacheMissingError("/path/to/cache"))
      expect(mockLog.error).toHaveBeenCalled()
      expect(mockConfirm).toHaveBeenCalled()
    })

    it("should handle CacheCorruptedError", async () => {
      await handleError(new CacheCorruptedError("Malformed JSON"))
      expect(mockLog.error).toHaveBeenCalled()
      expect(exitSpy).toHaveBeenCalledWith(1)
    })

    it("should handle PermissionDeniedError", async () => {
      await handleError(new PermissionDeniedError("/path", "write"))
      expect(mockLog.error).toHaveBeenCalled()
      expect(exitSpy).toHaveBeenCalledWith(1)
    })

    it("should handle ConcurrentModificationError", async () => {
      await handleError(new ConcurrentModificationError("/path"))
      expect(mockLog.error).toHaveBeenCalled()
      expect(exitSpy).toHaveBeenCalledWith(1)
    })

    it("should handle InvalidConfigError", async () => {
      await handleError(new InvalidConfigError("Invalid agent"))
      expect(mockLog.error).toHaveBeenCalled()
      expect(exitSpy).toHaveBeenCalledWith(1)
    })

    it("should handle CacheExpiredError", async () => {
      mockConfirm.mockResolvedValue(false)
      await handleError(new CacheExpiredError(10))
      expect(mockLog.warn).toHaveBeenCalled()
      expect(mockConfirm).toHaveBeenCalled()
    })

    it("should handle unknown errors", async () => {
      await handleError(new Error("Unknown error"))
      expect(mockLog.error).toHaveBeenCalled()
      expect(exitSpy).toHaveBeenCalledWith(1)
    })
  })

  describe("offerCacheRefresh", () => {
    it("should refresh cache when confirmed", async () => {
      mockConfirm.mockResolvedValue(true)
      await offerCacheRefresh()
      expect(mockExeca).toHaveBeenCalledWith("opencode", ["models", "--refresh"])
      expect(mockLog.success).toHaveBeenCalled()
    })

    it("should not refresh when declined", async () => {
      mockConfirm.mockResolvedValue(false)
      await offerCacheRefresh()
      expect(mockExeca).not.toHaveBeenCalled()
    })
  })

  describe("validateCacheAge", () => {
    it("should warn if cache is older than 7 days", async () => {
      const eightDaysAgo = Date.now() - 8 * 24 * 60 * 60 * 1000
      mockStat.mockResolvedValue({ mtime: new Date(eightDaysAgo) })
      mockConfirm.mockResolvedValue(false)

      await validateCacheAge("/path/to/cache")
      expect(mockLog.warn).toHaveBeenCalled()
      expect(mockConfirm).toHaveBeenCalled()
    })

    it("should not warn if cache is fresh", async () => {
      const oneDayAgo = Date.now() - 1 * 24 * 60 * 60 * 1000
      mockStat.mockResolvedValue({ mtime: new Date(oneDayAgo) })

      await validateCacheAge("/path/to/cache")
      expect(mockLog.warn).not.toHaveBeenCalled()
    })
  })
})
