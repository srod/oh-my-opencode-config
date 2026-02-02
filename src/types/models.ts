import { z } from "zod"

export const ModelSchema = z
  .object({
    id: z.string(),
    capabilities: z.record(z.string(), z.boolean()).optional(),
  })
  .passthrough()

export type Model = z.infer<typeof ModelSchema>

export const ProviderSchema = z
  .object({
    id: z.string(),
    name: z.string().optional(),
    models: z.record(z.string(), ModelSchema),
  })
  .passthrough()
export type Provider = z.infer<typeof ProviderSchema>

export const ModelsCacheSchema = z.record(z.string(), ProviderSchema)
export type ModelsCache = z.infer<typeof ModelsCacheSchema>

// Custom model format from opencode.json (e.g., antigravity plugin models)
export const CustomModelVariantSchema = z.record(z.string(), z.unknown())
export type CustomModelVariant = z.infer<typeof CustomModelVariantSchema>

export const CustomModelSchema = z
  .object({
    name: z.string(),
    limit: z
      .object({
        context: z.number().optional(),
        output: z.number().optional(),
      })
      .optional(),
    modalities: z
      .object({
        input: z.array(z.string()).optional(),
        output: z.array(z.string()).optional(),
      })
      .optional(),
    variants: z.record(z.string(), CustomModelVariantSchema).optional(),
  })
  .passthrough()

export type CustomModel = z.infer<typeof CustomModelSchema>

export const CustomProviderSchema = z
  .object({
    models: z.record(z.string(), CustomModelSchema),
  })
  .passthrough()

export type CustomProvider = z.infer<typeof CustomProviderSchema>

export const OpenCodeConfigSchema = z
  .object({
    provider: z.record(z.string(), CustomProviderSchema).optional(),
  })
  .passthrough()

export type OpenCodeConfig = z.infer<typeof OpenCodeConfigSchema>
