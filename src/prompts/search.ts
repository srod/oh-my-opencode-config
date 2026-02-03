import { select, text } from "@clack/prompts"
import chalk from "chalk"

export type SearchableAction = "BACK_ACTION"

export type SearchableSelectOption =
  | {
      value: string
      label: string
      hint?: string
    }
  | {
      value: symbol
      label: string
      hint?: string
    }

export interface SearchableSelectOptions<T> {
  items: T[]
  getOption: (item: T) => SearchableSelectOption
  getSearchText: (item: T) => string
  message: (searchTerm: string) => string
  searchPlaceholder: string
  backLabel?: string
  canGoBack?: boolean
}

const SEARCH_ACTION = Symbol("search")
const CLEAR_ACTION = Symbol("clear")
export const SELECTION_NOT_FOUND = Symbol("selection-not-found")

export async function searchableSelect<T>(
  options: SearchableSelectOptions<T>,
): Promise<T | symbol | SearchableAction> {
  const {
    items,
    getOption,
    getSearchText,
    message,
    searchPlaceholder,
    backLabel = "Back",
    canGoBack = false,
  } = options

  let filteredItems = [...items]
  let searchTerm = ""

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const valueMap = new Map<string | symbol, T>()
    const itemOptions = filteredItems.map((item) => {
      const option = getOption(item)
      valueMap.set(option.value, item)
      return option
    })

    const searchOption: SearchableSelectOption = {
      value: SEARCH_ACTION,
      label: `${chalk.cyan("🔍")} Search/Filter...`,
      hint: searchTerm ? `Current filter: "${searchTerm}"` : undefined,
    }

    const clearOption: SearchableSelectOption | null = searchTerm
      ? {
          value: CLEAR_ACTION,
          label: `${chalk.gray("❌")} Clear filter`,
        }
      : null

    const backOptions: SearchableSelectOption[] = canGoBack
      ? [
          {
            value: "BACK_ACTION",
            label: `${chalk.yellow("←")} ${backLabel}`,
          },
        ]
      : []

    const selection = await select<string | symbol>({
      message: message(searchTerm),
      options: [
        searchOption,
        ...(clearOption ? [clearOption] : []),
        ...backOptions,
        ...itemOptions,
      ],
    })

    if (selection === SEARCH_ACTION) {
      const term = await text({
        message: "Enter search term:",
        placeholder: searchPlaceholder,
        initialValue: searchTerm,
      })

      if (typeof term === "symbol") return term
      searchTerm = term
      const lowered = term.toLowerCase()
      filteredItems = items.filter((item) => getSearchText(item).toLowerCase().includes(lowered))
      continue
    }

    if (selection === CLEAR_ACTION) {
      searchTerm = ""
      filteredItems = [...items]
      continue
    }

    const selectedItem = valueMap.get(selection)
    if (!selectedItem) {
      if (selection === "BACK_ACTION") {
        return "BACK_ACTION"
      }
      if (typeof selection === "symbol") return selection
      return SELECTION_NOT_FOUND
    }
    return selectedItem
  }
}
