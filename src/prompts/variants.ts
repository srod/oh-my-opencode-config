import { select } from "@clack/prompts"
import chalk from "chalk"

export const VARIANTS = ["low", "medium", "high", "max"] as const
export type VariantAction = "BACK_ACTION"

export async function selectVariant(
  currentVariant?: string,
): Promise<string | undefined | symbol | VariantAction> {
  const result = await select({
    message: "Select variant preference",
    options: [
      {
        value: "BACK_ACTION",
        label: `${chalk.yellow("←")} Back to model selection`,
      },
      { value: "none", label: "None (Default)", hint: "Let the system decide" },
      ...VARIANTS.map((v) => ({
        value: v,
        label: v.charAt(0).toUpperCase() + v.slice(1),
        hint: v === currentVariant ? chalk.blue("(Current)") : undefined,
      })),
    ],
  })

  if (typeof result === "symbol") return result
  if (result === "BACK_ACTION") return "BACK_ACTION"
  if (result === "none") return undefined
  return result
}
