import { select } from "@clack/prompts"
import chalk from "chalk"

export type ProviderAction = "BACK_ACTION"

export async function selectProvider(
  providers: string[],
  canGoBack = false,
): Promise<string | symbol | ProviderAction> {
  const providerOptions = providers.map((provider) => ({
    value: provider,
    label: provider,
    hint: chalk.dim(`Select to see ${provider} models`),
  }))

  const backOption = canGoBack
    ? [
        {
          value: "BACK_ACTION",
          label: `${chalk.yellow("←")} Back to agent selection`,
        },
      ]
    : []

  return select({
    message: "Select provider",
    options: [...backOption, ...providerOptions],
  })
}
