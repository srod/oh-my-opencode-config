import { describe, expect, test } from "bun:test"
import { deepMerge } from "./merge.js"

describe("deepMerge", () => {
  test("skips prototype pollution keys", () => {
    const override = Object.create(null) as Record<string, unknown>
    override.__proto__ = { polluted: true }
    override.constructor = { injected: true }
    override.prototype = { injected: true }

    const merged = deepMerge({}, override) as Record<string, unknown>

    expect(({} as Record<string, unknown> & { polluted?: boolean }).polluted).toBeUndefined()
    expect(Object.prototype.hasOwnProperty.call(merged, "__proto__")).toBe(false)
    expect(Object.prototype.hasOwnProperty.call(merged, "constructor")).toBe(false)
    expect(Object.prototype.hasOwnProperty.call(merged, "prototype")).toBe(false)
  })
})
