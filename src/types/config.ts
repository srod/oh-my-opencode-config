import { z } from "zod"

export const AgentConfigSchema = z.object({
  model: z.string(),
  variant: z.string().optional(),
})
export type AgentConfig = z.infer<typeof AgentConfigSchema>

export const CategoryConfigSchema = z.object({
  model: z.string(),
  variant: z.string().optional(),
})
export type CategoryConfig = z.infer<typeof CategoryConfigSchema>

export const ConfigSchema = z.object({
  agents: z.record(z.string(), AgentConfigSchema).optional(),
  categories: z.record(z.string(), CategoryConfigSchema).optional(),
})
export type Config = z.infer<typeof ConfigSchema>
