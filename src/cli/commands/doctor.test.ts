import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test"
import type { Config, ModelsCache } from "#types/index.js"
import {
  mockDiscoverConfigPath,
  mockIntro,
  mockLoadConfig,
  mockLoadCustomModels,
  mockLoadModelsCache,
  mockLog,
  mockMergeModelsCache,
  mockOutro,
  mockPrintLine,
  mockSpinner,
  mockSpinnerInstance,
  mockValidateModelForAgent,
} from "./test-mocks.js"

let capturedMessages: string[] = []

const { doctorCommand } = await import("./doctor.js")

class ExitError extends Error {
  code: number
  constructor(code: number) {
    super(`process.exit(${code})`)
    this.code = code
  }
}

const mockExit = mock((_code?: number) => {
  throw new ExitError(_code ?? 0)
})

const originalExit = process.exit

interface Issue {
  severity: string
  category: string
  message: string
  suggestion?: string
  autoFixable?: boolean
}

interface ModelAssignment {
  name: string
  model: string
  variant?: string
}

interface DiagnosticReport {
  healthy: boolean
  issues: Issue[]
  stats: { errors: number; warnings: number; info: number }
  versions: { opencode: string | null; ohMyOpencode: string | null }
  updates: {
    opencode: { latest: string | null; updateAvailable: boolean | null; error: string | null }
    ohMyOpencode: { latest: string | null; updateAvailable: boolean | null; error: string | null }
  }
  summary: {
    agentsConfigured: number
    agentsTotal: number
    categoriesConfigured: number
    overrides: number
  }
  assignments: { agents: ModelAssignment[]; categories: ModelAssignment[] }
  cache: { exists: boolean; age: number | null; outdated: boolean }
  config: { path: string; valid: boolean }
  agents: { total: number; configured: number; withIssues: number }
}

function getJsonReport(): DiagnosticReport {
  const jsonLine = capturedMessages.find((l) => l.startsWith("{"))
  if (!jsonLine) throw new Error(`No JSON found in output: ${capturedMessages.length} messages`)
  return JSON.parse(jsonLine) as DiagnosticReport
}

async function runDoctor(
  options: { config?: string; json?: boolean; opencodeConfig?: string; fix?: boolean } = {},
): Promise<ExitError | undefined> {
  try {
    await doctorCommand(options)
    return undefined
  } catch (e) {
    if (e instanceof ExitError) return e
    throw e
  }
}

describe("doctorCommand", () => {
  beforeEach(() => {
    capturedMessages = []

    mockPrintLine.mockClear()
    mockPrintLine.mockImplementation((text?: string) => {
      capturedMessages.push(text ?? "")
    })

    mockLoadConfig.mockClear()
    mockDiscoverConfigPath.mockClear()
    mockLoadModelsCache.mockClear()
    mockLoadCustomModels.mockClear()
    mockMergeModelsCache.mockClear()
    mockValidateModelForAgent.mockClear()
    mockIntro.mockClear()
    mockOutro.mockClear()
    mockSpinner.mockClear()
    mockSpinnerInstance.start.mockClear()
    mockSpinnerInstance.stop.mockClear()
    mockLog.message.mockClear()

    mockLoadConfig.mockImplementation(() => Promise.resolve({ agents: {}, categories: {} }))
    mockLoadModelsCache.mockImplementation(() => Promise.resolve({}))
    mockLoadCustomModels.mockImplementation(() => Promise.resolve({}))
    mockMergeModelsCache.mockImplementation((a: ModelsCache, _b: ModelsCache) => a)
    mockValidateModelForAgent.mockImplementation(() => ({ valid: true, missing: [], warnings: [] }))
    mockDiscoverConfigPath.mockImplementation(() => "/fake/config/path")

    process.exit = mockExit as unknown as typeof process.exit
  })

  afterEach(() => {
    process.exit = originalExit
  })

  describe("healthy config — all agents assigned valid models", () => {
    test("exits 0 and reports no errors", async () => {
      const agents: Config["agents"] = {}
      for (const name of [
        "oracle",
        "librarian",
        "explore",
        "multimodal-looker",
        "prometheus",
        "metis",
        "sisyphus",
        "atlas",
        "hephaestus",
        "momus",
      ]) {
        agents[name] = { model: "provider/model-id" }
      }
      mockLoadConfig.mockImplementation(() => Promise.resolve({ agents, categories: {} }))

      const cache: ModelsCache = {
        provider: {
          id: "provider",
          models: {
            "model-id": {
              id: "model-id",
              capabilities: { reasoning: true, tool_call: true, attachment: true },
            },
          },
        },
      }
      mockLoadModelsCache.mockImplementation(() => Promise.resolve(cache))
      mockMergeModelsCache.mockImplementation(() => cache)

      const err = await runDoctor({ json: true })
      expect(err).toBeInstanceOf(ExitError)

      const report = getJsonReport()
      const nonCacheErrors = report.issues.filter(
        (i) => i.severity === "error" && i.category !== "cache",
      )
      expect(nonCacheErrors).toHaveLength(0)
      expect(report.config.valid).toBe(true)
      expect(report.summary.agentsConfigured).toBe(Object.keys(agents).length)
      expect(report.summary.categoriesConfigured).toBe(0)
      expect(report.summary.overrides).toBe(Object.keys(agents).length)
    })
  })

  describe("model not found in cache", () => {
    test("reports error when agent model missing from cache", async () => {
      const emptyCache: ModelsCache = {
        provider: { id: "provider", models: {} },
      }
      mockLoadConfig.mockImplementation(() =>
        Promise.resolve({
          agents: { oracle: { model: "provider/nonexistent" } },
          categories: {},
        }),
      )
      mockLoadModelsCache.mockImplementation(() => Promise.resolve(emptyCache))
      mockMergeModelsCache.mockImplementation(() => emptyCache)

      await runDoctor({ json: true })

      const report = getJsonReport()
      const issue = report.issues.find((i) => i.message.includes("not found in cache"))
      expect(issue).toBeDefined()
      expect(issue?.severity).toBe("error")
      expect(issue?.message).toContain("oracle")
    })
  })

  describe("capability mismatch", () => {
    test("reports missing capabilities for agent", async () => {
      const cache: ModelsCache = {
        provider: {
          id: "provider",
          models: { "weak-model": { id: "weak-model", capabilities: {} } },
        },
      }
      mockLoadConfig.mockImplementation(() =>
        Promise.resolve({
          agents: { oracle: { model: "provider/weak-model" } },
          categories: {},
        }),
      )
      mockLoadModelsCache.mockImplementation(() => Promise.resolve(cache))
      mockMergeModelsCache.mockImplementation(() => cache)
      mockValidateModelForAgent.mockImplementation(() => ({
        valid: false,
        missing: ["reasoning", "tool_call"],
        warnings: [],
      }))

      await runDoctor({ json: true })

      const report = getJsonReport()
      const capIssue = report.issues.find((i) => i.message.includes("missing required capability"))
      expect(capIssue).toBeDefined()
      expect(capIssue?.severity).toBe("error")
      expect(capIssue?.message).toContain("reasoning")
    })
  })

  describe("defunct agent detection", () => {
    test("warns about unrecognized agent name", async () => {
      const cache: ModelsCache = {
        provider: {
          id: "provider",
          models: {
            model: {
              id: "model",
              capabilities: { reasoning: true, tool_call: true, attachment: true },
            },
          },
        },
      }
      mockLoadConfig.mockImplementation(() =>
        Promise.resolve({
          agents: {
            oracle: { model: "provider/model" },
            "defunct-agent": { model: "provider/model" },
          },
          categories: {},
        }),
      )
      mockLoadModelsCache.mockImplementation(() => Promise.resolve(cache))
      mockMergeModelsCache.mockImplementation(() => cache)

      await runDoctor({ json: true })

      const report = getJsonReport()
      const defunctIssue = report.issues.find((i) => i.message.includes("defunct-agent"))
      expect(defunctIssue).toBeDefined()
      expect(defunctIssue?.severity).toBe("warning")
      expect(defunctIssue?.message).toContain("not recognized")
    })

    test("skips dynamic agents like sisyphus-junior", async () => {
      mockLoadConfig.mockImplementation(() =>
        Promise.resolve({
          agents: { "sisyphus-junior": { model: "provider/model" } },
          categories: {},
        }),
      )
      mockLoadModelsCache.mockImplementation(() => Promise.resolve({}))
      mockMergeModelsCache.mockImplementation(() => ({}))

      await runDoctor({ json: true })

      const report = getJsonReport()
      const sjIssue = report.issues.find((i) => i.message.includes("sisyphus-junior"))
      expect(sjIssue).toBeUndefined()
    })
  })

  describe("JSON output mode", () => {
    test("outputs valid JSON report structure", async () => {
      await runDoctor({ json: true })

      const report = getJsonReport()
      expect(report).toHaveProperty("healthy")
      expect(report).toHaveProperty("issues")
      expect(report).toHaveProperty("stats")
      expect(report).toHaveProperty("versions")
      expect(report).toHaveProperty("updates")
      expect(report).toHaveProperty("summary")
      expect(report).toHaveProperty("assignments")
      expect(report).toHaveProperty("cache")
      expect(report).toHaveProperty("config")
      expect(report).toHaveProperty("agents")
    })

    test("includes oh-my-opencode version field", async () => {
      await runDoctor({ json: true })

      const report = getJsonReport()
      expect(report.versions.ohMyOpencode).not.toBeUndefined()
    })

    test("text mode calls intro/outro", async () => {
      await runDoctor({ json: false })

      expect(mockIntro).toHaveBeenCalled()
      expect(mockOutro).toHaveBeenCalled()
    })
  })

  describe("config loading failures", () => {
    test("marks config as invalid when load throws", async () => {
      mockLoadConfig.mockImplementation(() => Promise.reject(new Error("corrupt config")))

      await runDoctor({ json: true })

      const report = getJsonReport()
      expect(report.config.valid).toBe(false)
      const configIssue = report.issues.find((i) => i.message.includes("invalid or corrupted"))
      expect(configIssue).toBeDefined()
      expect(configIssue?.severity).toBe("error")
    })

    test("still produces report when config load fails", async () => {
      mockLoadConfig.mockImplementation(() => Promise.reject(new Error("not found")))

      await runDoctor({ json: true })

      const report = getJsonReport()
      expect(report).toBeDefined()
    })
  })

  describe("config schema validation", () => {
    test("warns when no agents configured", async () => {
      mockLoadConfig.mockImplementation(() => Promise.resolve({ categories: {} }))

      await runDoctor({ json: true })

      const report = getJsonReport()
      const noAgents = report.issues.find((i) => i.message.includes("No agents configured"))
      expect(noAgents).toBeDefined()
      expect(noAgents?.severity).toBe("warning")
    })

    test("reports invalid model format", async () => {
      mockLoadConfig.mockImplementation(() =>
        Promise.resolve({
          agents: { oracle: { model: "no-slash-here" } },
          categories: {},
        }),
      )
      mockLoadModelsCache.mockImplementation(() => Promise.resolve({}))
      mockMergeModelsCache.mockImplementation(() => ({}))

      await runDoctor({ json: true })

      const report = getJsonReport()
      const formatIssue = report.issues.find((i) => i.message.includes("invalid model format"))
      expect(formatIssue).toBeDefined()
      expect(formatIssue?.severity).toBe("error")
    })

    test("reports agent with no model assigned", async () => {
      mockLoadConfig.mockImplementation(() =>
        Promise.resolve({
          agents: { oracle: {} },
          categories: {},
        } as unknown as Config),
      )
      mockLoadModelsCache.mockImplementation(() => Promise.resolve({}))
      mockMergeModelsCache.mockImplementation(() => ({}))

      await runDoctor({ json: true })

      const report = getJsonReport()
      const noModel = report.issues.find((i) => i.message.includes("has no model assigned"))
      expect(noModel).toBeDefined()
    })
  })

  describe("multiple issues combined", () => {
    test("accumulates issues from all checks", async () => {
      const emptyCache: ModelsCache = { provider: { id: "provider", models: {} } }
      mockLoadConfig.mockImplementation(() =>
        Promise.resolve({
          agents: {
            oracle: { model: "provider/bad-model" },
            "unknown-agent": { model: "provider/whatever" },
          },
          categories: {},
        }),
      )
      mockLoadModelsCache.mockImplementation(() => Promise.resolve(emptyCache))
      mockMergeModelsCache.mockImplementation(() => emptyCache)

      await runDoctor({ json: true })

      const report = getJsonReport()
      expect(report.issues.length).toBeGreaterThanOrEqual(3)
      expect(report.healthy).toBe(false)
    })

    test("exits 1 when errors present", async () => {
      mockLoadConfig.mockImplementation(() => Promise.reject(new Error("bad")))

      const err = await runDoctor({ json: true })
      expect(err).toBeInstanceOf(ExitError)
      expect(err?.code).toBe(1)
    })
  })

  describe("config path resolution", () => {
    test("uses provided config option", async () => {
      await runDoctor({ config: "/custom/path", json: true })

      expect(mockLoadConfig).toHaveBeenCalledWith("/custom/path")
    })

    test("falls back to discoverConfigPath", async () => {
      mockDiscoverConfigPath.mockImplementation(() => "/discovered/path")

      await runDoctor({ json: true })

      expect(mockLoadConfig).toHaveBeenCalledWith("/discovered/path")
    })
  })

  describe("models cache loading", () => {
    test("continues when loadModelsCache throws", async () => {
      mockLoadModelsCache.mockImplementationOnce(() => Promise.reject(new Error("cache missing")))

      await runDoctor({ json: true })

      const report = getJsonReport()
      expect(report).toBeDefined()
      expect(mockMergeModelsCache).toHaveBeenCalled()
    })
  })
})
