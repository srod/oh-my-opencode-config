import { beforeEach, describe, expect, mock, test } from "bun:test"
import { mockSelect, mockSpinner, mockSpinnerInstance } from "#test-utils/clack-mocks.js"

const { searchableSelect } = await import("./search.js")

describe("searchableSelect", () => {
  beforeEach(() => {
    mockSelect.mockClear()
    mockSpinner.mockClear()
    mockSpinnerInstance.start.mockClear()
    mockSpinnerInstance.stop.mockClear()
  })

  test("refresh action reloads items and returns selection from refreshed list", async () => {
    const onRefresh = mock(() => Promise.resolve(["openai/gpt-5"]))
    let selectCallCount = 0

    mockSelect.mockImplementation(
      (options: { options: Array<{ value: string | symbol; label: string }> }) => {
        selectCallCount++

        if (selectCallCount === 1) {
          const refreshOption = options.options.find((option) =>
            option.label.includes("Refresh models"),
          )
          return Promise.resolve(refreshOption?.value ?? Symbol("missing-refresh-option"))
        }

        const modelOption = options.options.find((option) => option.value === "openai/gpt-5")
        return Promise.resolve(modelOption?.value ?? Symbol("missing-model-option"))
      },
    )

    const selected = await searchableSelect({
      items: ["anthropic/claude-opus-4-6"],
      getOption: (item) => ({ value: item, label: item }),
      getSearchText: (item) => item,
      message: () => "Select model",
      searchPlaceholder: "e.g. gpt-5",
      onRefresh,
    })

    expect(onRefresh).toHaveBeenCalledTimes(1)
    expect(mockSpinner).toHaveBeenCalledTimes(1)
    expect(mockSpinnerInstance.start).toHaveBeenCalledWith("Refreshing models...")
    expect(mockSpinnerInstance.stop).toHaveBeenCalledWith("Refreshed 1 model(s).")
    expect(selected).toBe("openai/gpt-5")
  })
})
