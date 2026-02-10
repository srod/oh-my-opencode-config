import { afterEach, describe, expect, test } from "bun:test"
import { checkNpmUpdates, checkSingleNpmUpdate } from "./npm.js"

const realFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = realFetch
})

describe("checkNpmUpdates", () => {
  test("captures fetch errors in update status", async () => {
    const error = new Error("network down")
    globalThis.fetch = () => Promise.reject(error)

    const report = await checkNpmUpdates({
      opencode: "1.0.0",
      ohMyOpencode: "1.0.0",
    })

    expect(report.opencode.latest).toBeNull()
    expect(report.opencode.updateAvailable).toBeNull()
    expect(report.opencode.error).toBe("network down")
  })

  test("records http status when registry responds with an error", async () => {
    globalThis.fetch = () => Promise.resolve(new Response("", { status: 503 }))

    const report = await checkNpmUpdates({
      opencode: "1.0.0",
      ohMyOpencode: "1.0.0",
    })

    expect(report.opencode.latest).toBeNull()
    expect(report.opencode.updateAvailable).toBeNull()
    expect(report.opencode.error).toBe("HTTP 503")
  })
})

describe("checkSingleNpmUpdate", () => {
  test("reports update available when latest is newer", async () => {
    globalThis.fetch = () =>
      Promise.resolve(new Response(JSON.stringify({ "dist-tags": { latest: "1.2.0" } })))

    const status = await checkSingleNpmUpdate("oh-my-opencode-config", "1.0.0")

    expect(status.latest).toBe("1.2.0")
    expect(status.updateAvailable).toBe(true)
    expect(status.error).toBeNull()
  })

  test("reports up to date when latest matches current", async () => {
    globalThis.fetch = () =>
      Promise.resolve(new Response(JSON.stringify({ "dist-tags": { latest: "1.2.0" } })))

    const status = await checkSingleNpmUpdate("oh-my-opencode-config", "1.2.0")

    expect(status.latest).toBe("1.2.0")
    expect(status.updateAvailable).toBe(false)
    expect(status.error).toBeNull()
  })

  test("returns unknown update status when semver cannot be parsed", async () => {
    globalThis.fetch = () =>
      Promise.resolve(new Response(JSON.stringify({ "dist-tags": { latest: "canary" } })))

    const status = await checkSingleNpmUpdate("oh-my-opencode-config", "dev-build")

    expect(status.latest).toBe("canary")
    expect(status.updateAvailable).toBeNull()
    expect(status.error).toBeNull()
  })

  test("captures fetch errors in update status", async () => {
    const error = new Error("network down")
    globalThis.fetch = () => Promise.reject(error)

    const status = await checkSingleNpmUpdate("oh-my-opencode-config", "1.0.0")

    expect(status.latest).toBeNull()
    expect(status.updateAvailable).toBeNull()
    expect(status.error).toBe("network down")
  })
})
