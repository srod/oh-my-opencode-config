import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { maybeNotifyCliUpdate } from "./notifier.js"

const UPDATE_NOTIFIER_CACHE_TTL_MS = 24 * 60 * 60 * 1000
const TEST_CLI_VERSION = "1.0.0"

const checkUpdate = mock(
  (): Promise<{ latest: string | null; updateAvailable: boolean | null; error: string | null }> =>
    Promise.resolve({
      latest: null,
      updateAvailable: null,
      error: null,
    }),
)
const print = mock((_text: string) => {})

const originalNoUpdateNotifierEnv = process.env.OH_MY_OPENCODE_CONFIG_NO_UPDATE_NOTIFIER
const originalCiEnv = process.env.CI
const originalStdinIsTTY = Reflect.get(process.stdin, "isTTY")
const originalStdoutIsTTY = Reflect.get(process.stdout, "isTTY")

let tmpDir = ""
let cachePath = ""
let nowMs = 0

function setTTY(stdinIsTTY: boolean, stdoutIsTTY: boolean): void {
  Object.defineProperty(process.stdin, "isTTY", {
    value: stdinIsTTY,
    configurable: true,
  })
  Object.defineProperty(process.stdout, "isTTY", {
    value: stdoutIsTTY,
    configurable: true,
  })
}

function now(): number {
  return nowMs
}

function defaultOverrides() {
  return {
    cachePath,
    cacheTtlMs: UPDATE_NOTIFIER_CACHE_TTL_MS,
    cliVersion: TEST_CLI_VERSION,
    checkUpdate,
    print,
    now,
  }
}

async function writeCache(payload: {
  checkedAt: number
  currentVersion: string
  latest: string | null
  updateAvailable: boolean | null
  error: string | null
  notifiedVersion?: string | null
}): Promise<void> {
  await Bun.write(cachePath, JSON.stringify({ notifiedVersion: null, ...payload }))
}

describe("maybeNotifyCliUpdate", () => {
  beforeEach(async () => {
    print.mockClear()
    checkUpdate.mockClear()
    checkUpdate.mockResolvedValue({
      latest: null,
      updateAvailable: null,
      error: null,
    })

    Reflect.deleteProperty(process.env, "OH_MY_OPENCODE_CONFIG_NO_UPDATE_NOTIFIER")
    Reflect.deleteProperty(process.env, "CI")
    setTTY(true, true)

    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "update-notifier-test-"))
    cachePath = path.join(tmpDir, "update-notifier.json")
    nowMs = Date.now()
  })

  afterEach(async () => {
    if (originalNoUpdateNotifierEnv === undefined) {
      Reflect.deleteProperty(process.env, "OH_MY_OPENCODE_CONFIG_NO_UPDATE_NOTIFIER")
    } else {
      process.env.OH_MY_OPENCODE_CONFIG_NO_UPDATE_NOTIFIER = originalNoUpdateNotifierEnv
    }
    if (originalCiEnv === undefined) {
      Reflect.deleteProperty(process.env, "CI")
    } else {
      process.env.CI = originalCiEnv
    }

    if (originalStdinIsTTY === undefined) {
      Reflect.deleteProperty(process.stdin, "isTTY")
    } else {
      Object.defineProperty(process.stdin, "isTTY", {
        value: originalStdinIsTTY,
        configurable: true,
      })
    }
    if (originalStdoutIsTTY === undefined) {
      Reflect.deleteProperty(process.stdout, "isTTY")
    } else {
      Object.defineProperty(process.stdout, "isTTY", {
        value: originalStdoutIsTTY,
        configurable: true,
      })
    }

    await fs.rm(tmpDir, { recursive: true, force: true })
  })

  test("skips when terminal is non-interactive", async () => {
    setTTY(false, false)

    const result = await maybeNotifyCliUpdate({}, defaultOverrides())

    expect(result.pendingRefresh).toBeNull()
    expect(checkUpdate).not.toHaveBeenCalled()
    expect(print).not.toHaveBeenCalled()
  })

  test("skips when json output is enabled", async () => {
    const result = await maybeNotifyCliUpdate({ json: true }, defaultOverrides())

    expect(result.pendingRefresh).toBeNull()
    expect(checkUpdate).not.toHaveBeenCalled()
    expect(print).not.toHaveBeenCalled()
  })

  test("skips when notifier is disabled by option", async () => {
    const result = await maybeNotifyCliUpdate({ updateNotifier: false }, defaultOverrides())

    expect(result.pendingRefresh).toBeNull()
    expect(checkUpdate).not.toHaveBeenCalled()
    expect(print).not.toHaveBeenCalled()
  })

  test("skips when notifier is disabled by environment variable", async () => {
    process.env.OH_MY_OPENCODE_CONFIG_NO_UPDATE_NOTIFIER = "1"

    const result = await maybeNotifyCliUpdate({}, defaultOverrides())

    expect(result.pendingRefresh).toBeNull()
    expect(checkUpdate).not.toHaveBeenCalled()
    expect(print).not.toHaveBeenCalled()
  })

  test("skips in CI", async () => {
    process.env.CI = "true"

    const result = await maybeNotifyCliUpdate({}, defaultOverrides())

    expect(result.pendingRefresh).toBeNull()
    expect(checkUpdate).not.toHaveBeenCalled()
    expect(print).not.toHaveBeenCalled()
  })

  test("shows banner from fresh cache and suppresses repeat notification", async () => {
    await writeCache({
      checkedAt: nowMs,
      currentVersion: TEST_CLI_VERSION,
      latest: "2.0.0",
      updateAvailable: true,
      error: null,
      notifiedVersion: null,
    })

    const result = await maybeNotifyCliUpdate({}, defaultOverrides())

    expect(result.pendingRefresh).toBeNull()
    expect(checkUpdate).not.toHaveBeenCalled()
    expect(print).toHaveBeenCalledTimes(5)
    expect(print.mock.calls[1]?.[0]).toContain(`${TEST_CLI_VERSION} -> 2.0.0`)

    // Second call: notifiedVersion updated, no repeat
    print.mockClear()
    const result2 = await maybeNotifyCliUpdate({}, defaultOverrides())

    expect(result2.pendingRefresh).toBeNull()
    expect(checkUpdate).not.toHaveBeenCalled()
    expect(print).not.toHaveBeenCalled()
  })

  test("invalidates cache when CLI version changes (prevents downgrade notification)", async () => {
    await writeCache({
      checkedAt: nowMs,
      currentVersion: "0.9.0",
      latest: TEST_CLI_VERSION,
      updateAvailable: true,
      error: null,
      notifiedVersion: null,
    })

    checkUpdate.mockResolvedValueOnce({
      latest: TEST_CLI_VERSION,
      updateAvailable: false,
      error: null,
    })

    const result = await maybeNotifyCliUpdate({}, defaultOverrides())

    // No banner from stale-version cache
    expect(print).not.toHaveBeenCalled()
    // Triggers background refresh
    expect(result.pendingRefresh).not.toBeNull()
    await result.pendingRefresh

    expect(checkUpdate).toHaveBeenCalledTimes(1)
    const cached: unknown = JSON.parse(await Bun.file(cachePath).text())
    expect(cached).toMatchObject({
      currentVersion: TEST_CLI_VERSION,
      updateAvailable: false,
    })
  })

  test("refreshes stale cache in background without showing banner", async () => {
    await writeCache({
      checkedAt: nowMs - UPDATE_NOTIFIER_CACHE_TTL_MS - 1,
      currentVersion: TEST_CLI_VERSION,
      latest: TEST_CLI_VERSION,
      updateAvailable: false,
      error: null,
    })
    checkUpdate.mockResolvedValueOnce({
      latest: "2.0.0",
      updateAvailable: true,
      error: null,
    })

    const result = await maybeNotifyCliUpdate({}, defaultOverrides())

    // No banner during preAction — stale cache triggers background refresh
    expect(print).not.toHaveBeenCalled()
    expect(result.pendingRefresh).not.toBeNull()
    await result.pendingRefresh

    expect(checkUpdate).toHaveBeenCalledTimes(1)
    const cached: unknown = JSON.parse(await Bun.file(cachePath).text())
    expect(cached).toMatchObject({
      latest: "2.0.0",
      updateAvailable: true,
      checkedAt: nowMs,
      notifiedVersion: null,
    })
  })

  test("shows banner on next run after background refresh finds update", async () => {
    // First run: no cache → background refresh discovers update
    checkUpdate.mockResolvedValueOnce({
      latest: "2.0.0",
      updateAvailable: true,
      error: null,
    })

    const result1 = await maybeNotifyCliUpdate({}, defaultOverrides())
    expect(print).not.toHaveBeenCalled()
    await result1.pendingRefresh

    // Second run: fresh cache → shows banner
    print.mockClear()
    const result2 = await maybeNotifyCliUpdate({}, defaultOverrides())

    expect(result2.pendingRefresh).toBeNull()
    expect(checkUpdate).toHaveBeenCalledTimes(1)
    expect(print).toHaveBeenCalledTimes(5)
    expect(print.mock.calls[1]?.[0]).toContain(`${TEST_CLI_VERSION} -> 2.0.0`)
  })

  test("does not print notification when up to date", async () => {
    checkUpdate.mockResolvedValueOnce({
      latest: TEST_CLI_VERSION,
      updateAvailable: false,
      error: null,
    })

    const result = await maybeNotifyCliUpdate({}, defaultOverrides())

    expect(result.pendingRefresh).not.toBeNull()
    await result.pendingRefresh

    expect(checkUpdate).toHaveBeenCalledTimes(1)
    expect(print).not.toHaveBeenCalled()
  })

  test("stays silent on lookup errors by default", async () => {
    checkUpdate.mockResolvedValueOnce({
      latest: null,
      updateAvailable: null,
      error: "network down",
    })

    const result = await maybeNotifyCliUpdate({}, defaultOverrides())

    expect(result.pendingRefresh).not.toBeNull()
    await result.pendingRefresh

    expect(print).not.toHaveBeenCalled()
  })

  test("prints lookup errors in verbose mode", async () => {
    checkUpdate.mockResolvedValueOnce({
      latest: null,
      updateAvailable: null,
      error: "network down",
    })

    const result = await maybeNotifyCliUpdate({ verbose: true }, defaultOverrides())

    expect(result.pendingRefresh).not.toBeNull()
    await result.pendingRefresh

    expect(print).toHaveBeenCalledTimes(1)
    expect(print.mock.calls[0]?.[0]).toContain("Update notifier")
  })

  test("notifies again after ttl expires", async () => {
    await writeCache({
      checkedAt: nowMs,
      currentVersion: TEST_CLI_VERSION,
      latest: "2.0.0",
      updateAvailable: true,
      error: null,
      notifiedVersion: "2.0.0",
    })

    // Fresh cache, already notified — no banner
    const result1 = await maybeNotifyCliUpdate({}, defaultOverrides())
    expect(result1.pendingRefresh).toBeNull()
    expect(print).not.toHaveBeenCalled()

    // TTL expires → stale cache → background refresh
    nowMs += UPDATE_NOTIFIER_CACHE_TTL_MS + 1
    checkUpdate.mockResolvedValueOnce({
      latest: "2.0.0",
      updateAvailable: true,
      error: null,
    })

    const result2 = await maybeNotifyCliUpdate({}, defaultOverrides())
    expect(print).not.toHaveBeenCalled()
    expect(result2.pendingRefresh).not.toBeNull()
    await result2.pendingRefresh

    // Third run: fresh cache with notifiedVersion reset → shows banner
    print.mockClear()
    const result3 = await maybeNotifyCliUpdate({}, defaultOverrides())

    expect(result3.pendingRefresh).toBeNull()
    expect(print).toHaveBeenCalledTimes(5)
    expect(print.mock.calls[1]?.[0]).toContain(`${TEST_CLI_VERSION} -> 2.0.0`)
  })

  test("sanitizes untrusted latest version before printing", async () => {
    await writeCache({
      checkedAt: nowMs,
      currentVersion: TEST_CLI_VERSION,
      latest: "2.0.0\u001b[2J\u001b[H",
      updateAvailable: true,
      error: null,
      notifiedVersion: null,
    })

    const result = await maybeNotifyCliUpdate({}, defaultOverrides())

    expect(result.pendingRefresh).toBeNull()
    expect(checkUpdate).not.toHaveBeenCalled()
    expect(print).toHaveBeenCalledTimes(5)
    expect(print.mock.calls[1]?.[0]).toContain(`${TEST_CLI_VERSION} -> [untrusted version]`)
  })

  test("ignores invalid cache content and refreshes in background", async () => {
    await Bun.write(cachePath, "not-json")
    checkUpdate.mockResolvedValueOnce({
      latest: TEST_CLI_VERSION,
      updateAvailable: false,
      error: null,
    })

    const result = await maybeNotifyCliUpdate({}, defaultOverrides())

    expect(result.pendingRefresh).not.toBeNull()
    await result.pendingRefresh

    expect(checkUpdate).toHaveBeenCalledTimes(1)
  })
})
