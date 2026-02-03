import chalk from "chalk"
import { searchableSelect } from "./search.js"

export type ProviderAction = "BACK_ACTION"

export async function selectProvider(
  providers: string[],
  canGoBack = false,
): Promise<string | symbol | ProviderAction> {
  const sortedProviders = [...providers].sort((a, b) => a.localeCompare(b))

  return searchableSelect({
    items: sortedProviders,
    getOption: (provider) => ({
      value: provider,
      label: provider,
      hint: chalk.dim(`Select to see ${provider} models`),
    }),
    getSearchText: (provider) => provider,
    message: () => "Select provider",
    searchPlaceholder: "e.g. openai",
    backLabel: "Back to agent selection",
    canGoBack,
  })
}
