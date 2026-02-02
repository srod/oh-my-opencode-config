export enum Capability {
  Reasoning = "reasoning",
  ToolCall = "tool_call",
  Attachment = "attachment",
}

export type AgentRequirements = Partial<Record<Capability, boolean>>

export const DYNAMIC_AGENTS: ReadonlySet<string> = new Set(["sisyphus-junior"])

export const AGENT_REQUIREMENTS = {
  oracle: { [Capability.Reasoning]: true, [Capability.ToolCall]: true },
  librarian: { [Capability.ToolCall]: true },
  explore: { [Capability.ToolCall]: true },
  "multimodal-looker": { [Capability.Attachment]: true },
  prometheus: { [Capability.Reasoning]: true, [Capability.ToolCall]: true },
  metis: { [Capability.Reasoning]: true },
  sisyphus: { [Capability.ToolCall]: true, [Capability.Reasoning]: true },
  atlas: { [Capability.ToolCall]: true, [Capability.Reasoning]: true },
  hephaestus: { [Capability.ToolCall]: true, [Capability.Reasoning]: true },
  momus: { [Capability.Reasoning]: true },
} as const satisfies Record<string, AgentRequirements>
