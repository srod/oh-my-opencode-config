import { afterEach, describe, expect, test } from "bun:test"
import { checkNpmUpdates } from "./npm.js"

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
