import { describe, expect, it } from "bun:test"
import type { Model } from "#types/models.js"
import { Capability } from "#types/requirements.js"
import {
  AGENT_REQUIREMENTS,
  getMissingCapabilities,
  isModelSuitable,
  validateModelForAgent,
} from "./capabilities.js"

describe("capabilities validation", () => {
  const fullModel: Model = {
    id: "full-model",
    capabilities: {
      [Capability.Reasoning]: true,
      [Capability.ToolCall]: true,
      [Capability.Attachment]: true,
    },
  }

  const simpleModel: Model = {
    id: "simple-model",
    capabilities: {
      [Capability.ToolCall]: true,
    },
  }

  const _noCapModel: Model = {
    id: "no-cap-model",
    capabilities: {},
  }

  describe("validateModelForAgent", () => {
    it("should validate oracle requirements", () => {
      const result = validateModelForAgent(fullModel, "oracle")
      expect(result.valid).toBe(true)
      expect(result.missing).toEqual([])
    })

    it("should fail oracle if reasoning is missing", () => {
      const result = validateModelForAgent(simpleModel, "oracle")
      expect(result.valid).toBe(false)
      expect(result.missing).toContain(Capability.Reasoning)
    })

    it("should validate multimodal-looker requirements", () => {
      const result = validateModelForAgent(fullModel, "multimodal-looker")
      expect(result.valid).toBe(true)
    })

    it("should fail multimodal-looker if attachment is missing", () => {
      const result = validateModelForAgent(simpleModel, "multimodal-looker")
      expect(result.valid).toBe(false)
      expect(result.missing).toContain(Capability.Attachment)
    })

    it("should handle unknown agent with warning", () => {
      const result = validateModelForAgent(fullModel, "unknown-agent")
      expect(result.valid).toBe(true)
      expect(result.warnings[0]).toContain("Unknown agent")
    })
  })

  describe("getMissingCapabilities", () => {
    it("should return empty array when all requirements met", () => {
      const requirements = { [Capability.ToolCall]: true }
      const missing = getMissingCapabilities(fullModel, requirements)
      expect(missing).toEqual([])
    })

    it("should return missing capabilities", () => {
      const requirements = {
        [Capability.Reasoning]: true,
        [Capability.Attachment]: true,
      }
      const missing = getMissingCapabilities(simpleModel, requirements)
      expect(missing).toEqual([Capability.Reasoning, Capability.Attachment])
    })

    it("should return missing capabilities for model with no capabilities record", () => {
      const requirements = { [Capability.ToolCall]: true }
      const missing = getMissingCapabilities({ id: "test" }, requirements)
      expect(missing).toEqual([Capability.ToolCall])
    })
  })

  describe("isModelSuitable", () => {
    it("should return true when suitable", () => {
      const requirements = AGENT_REQUIREMENTS.librarian
      expect(isModelSuitable(simpleModel, requirements)).toBe(true)
    })

    it("should return false when not suitable", () => {
      const requirements = AGENT_REQUIREMENTS.oracle
      expect(isModelSuitable(simpleModel, requirements)).toBe(false)
    })
  })
})
