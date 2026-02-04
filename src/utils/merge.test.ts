import { describe, expect, test } from "bun:test"
import { deepMerge } from "./merge.js"

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

describe("deepMerge", () => {
  test("skips prototype pollution keys", () => {
    const override: Record<string, unknown> = Object.create(null)
    Object.defineProperty(override, "__proto__", {
      value: { polluted: true },
      enumerable: true,
      configurable: true,
      writable: true,
    })
    override.constructor = { injected: true }
    override.prototype = { injected: true }

    const merged = deepMerge({}, override)
    if (!isRecord(merged)) {
      throw new Error("Expected merged result to be an object")
    }

    expect(Object.hasOwn(Object.prototype, "polluted")).toBe(false)
    expect(Object.hasOwn(merged, "__proto__")).toBe(false)
    expect(Object.hasOwn(merged, "constructor")).toBe(false)
    expect(Object.hasOwn(merged, "prototype")).toBe(false)
  })

  test("merges shallow objects", () => {
    const base = { a: 1, b: 2 }
    const override = { b: 3, c: 4 }
    expect(deepMerge(base, override)).toEqual({ a: 1, b: 3, c: 4 })
  })

  test("merges nested objects recursively", () => {
    const base = { nested: { a: 1, b: 2 } }
    const override = { nested: { b: 3 } }
    expect(deepMerge(base, override)).toEqual({ nested: { a: 1, b: 3 } })
  })

  test("returns base when override is undefined", () => {
    const base = { a: 1 }
    expect(deepMerge(base, undefined)).toEqual({ a: 1 })
  })

  test("override wins for arrays", () => {
    const base = { arr: [1, 2] }
    const override = { arr: [3] }
    expect(deepMerge(base, override)).toEqual({ arr: [3] })
  })

  test("override wins for non-object inputs", () => {
    expect(deepMerge({ a: 1 }, "override")).toBe("override")
  })
})
