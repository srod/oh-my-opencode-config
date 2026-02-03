import { describe, expect, mock, spyOn, test } from "bun:test"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { CacheCorruptedError, CacheMissingError } from "#errors/types.js"
import type { ModelsCache } from "#types/models.js"
import { Capability } from "#types/requirements.js"
import { findModel, getAvailableModels, loadModelsCache } from "./parser.js"

const FAKE_CACHE_PATH = path.join(os.tmpdir(), `models-${Math.random().toString(36).slice(2)}.json`)

mock.module("#config/paths.js", () => ({
  MODELS_CACHE_PATH: FAKE_CACHE_PATH,
}))

describe("parser", () => {
  test("loadModelsCache throws if file missing", async () => {
    try {
      await fs.unlink(FAKE_CACHE_PATH)
    } catch {}

    await expect(loadModelsCache()).rejects.toThrow(CacheMissingError)
  })

  test("loadModelsCache throws if JSON invalid", async () => {
    await fs.writeFile(FAKE_CACHE_PATH, "invalid json")

    await expect(loadModelsCache()).rejects.toThrow(CacheCorruptedError)
    await expect(loadModelsCache()).rejects.toThrow(/Invalid JSON/)
  })

  test("loadModelsCache throws if schema invalid", async () => {
    await fs.writeFile(
      FAKE_CACHE_PATH,
      JSON.stringify({
        google: {
          "gemini-3-flash": { id: 123 },
        },
      }),
    )

    await expect(loadModelsCache()).rejects.toThrow(CacheCorruptedError)
  })

  test("loadModelsCache returns valid cache", async () => {
    const mockCache = {
      google: {
        id: "google",
        models: {
          "gemini-3-flash": {
            id: "gemini-3-flash",
            capabilities: { [Capability.Reasoning]: true },
          },
        },
      },
    }
    await fs.writeFile(FAKE_CACHE_PATH, JSON.stringify(mockCache))

    const cache = await loadModelsCache()
    expect(cache).toEqual(mockCache)
  })

  test("getAvailableModels filters cache by available model IDs", async () => {
    const cache: ModelsCache = {
      opencode: {
        id: "opencode",
        models: {
          "model-a": { id: "opencode/model-a" },
          "model-b": { id: "opencode/model-b" },
        },
      },
      google: {
        id: "google",
        models: {
          "gemini-flash": { id: "google/gemini-flash" },
        },
      },
    }

    const mockGetIds = spyOn(await import("./parser.js"), "getAvailableModelIds")
    mockGetIds.mockResolvedValue(new Set(["opencode/model-a", "google/gemini-flash"]))

    const models = await getAvailableModels(cache)
    expect(models).toHaveLength(2)
    const ids = models.map((m) => m.id)
    expect(ids).toContain("opencode/model-a")
    expect(ids).toContain("google/gemini-flash")
    expect(ids).not.toContain("opencode/model-b")
  })

  test("getAvailableModels returns empty array when no models available", async () => {
    const cache: ModelsCache = {
      opencode: {
        id: "opencode",
        models: { "model-a": { id: "opencode/model-a" } },
      },
    }

    const mockGetIds = spyOn(await import("./parser.js"), "getAvailableModelIds")
    mockGetIds.mockResolvedValue(new Set())

    const models = await getAvailableModels(cache)
    expect(models).toHaveLength(0)
  })

  test("findModel locates model", () => {
    const cache: ModelsCache = {
      p1: { id: "p1", models: { m1: { id: "m1" } } },
    }
    expect(findModel({ cache, providerId: "p1", modelId: "m1" })).toEqual({ id: "m1" })
    expect(findModel({ cache, providerId: "p1", modelId: "m2" })).toBeUndefined()
    expect(findModel({ cache, providerId: "p2", modelId: "m1" })).toBeUndefined()
  })
})
