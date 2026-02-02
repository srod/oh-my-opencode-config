import type { Model } from "../types/models.js"
import { AGENT_REQUIREMENTS, type AgentRequirements, Capability } from "../types/requirements.js"

export { AGENT_REQUIREMENTS }

export interface ValidationResult {
  valid: boolean
  missing: string[]
  warnings: string[]
}

export type AgentName = keyof typeof AGENT_REQUIREMENTS

const CAPABILITY_VALUES: ReadonlySet<string> = new Set(Object.values(Capability))

export function isAgentName(name: string): name is AgentName {
  return name in AGENT_REQUIREMENTS
}

export function isCapability(key: string): key is Capability {
  return CAPABILITY_VALUES.has(key)
}

function hasProperty<K extends string>(obj: object, key: K): obj is Record<K, unknown> {
  return key in obj
}

function getModelCapabilities(model: Model): AgentRequirements {
  if (model.capabilities) {
    const caps: AgentRequirements = {}
    for (const cap of Object.values(Capability)) {
      if (model.capabilities[cap] === true) {
        caps[cap] = true
      }
    }
    return caps
  }
  const caps: AgentRequirements = {}
  for (const cap of Object.values(Capability)) {
    if (hasProperty(model, cap) && model[cap] === true) {
      caps[cap] = true
    }
  }
  return caps
}

export function validateModelForAgent(model: Model, agentName: string): ValidationResult {
  if (!isAgentName(agentName)) {
    return {
      valid: true,
      missing: [],
      warnings: [`Unknown agent: ${agentName}`],
    }
  }

  const requirements = AGENT_REQUIREMENTS[agentName]
  const missing = getMissingCapabilities(model, requirements)

  return {
    valid: missing.length === 0,
    missing,
    warnings: [],
  }
}

export function getMissingCapabilities(model: Model, requirements: AgentRequirements): string[] {
  const missing: string[] = []
  const modelCapabilities = getModelCapabilities(model)

  for (const [capability, required] of Object.entries(requirements)) {
    if (required && isCapability(capability) && !modelCapabilities[capability]) {
      missing.push(capability)
    }
  }

  return missing
}

export function isModelSuitable(model: Model, requirements: AgentRequirements): boolean {
  const modelCapabilities = getModelCapabilities(model)

  for (const [capability, required] of Object.entries(requirements)) {
    if (required && isCapability(capability) && !modelCapabilities[capability]) {
      return false
    }
  }

  return true
}
