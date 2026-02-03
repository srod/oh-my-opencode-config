import type { Config } from "#types/config.js"

export type DiffType = "add" | "remove" | "modify"

export interface DiffEntry {
  type: DiffType
  path: string
  old?: unknown
  new?: unknown
}

export function generateDiff(oldConfig: Config, newConfig: Config): DiffEntry[] {
  const entries: DiffEntry[] = []

  diffSection(oldConfig.agents ?? {}, newConfig.agents ?? {}, "agents", entries)
  diffSection(oldConfig.categories ?? {}, newConfig.categories ?? {}, "categories", entries)

  return entries.sort((a, b) => a.path.localeCompare(b.path))
}

function diffSection(
  oldMap: Record<string, { model: string; variant?: string }>,
  newMap: Record<string, { model: string; variant?: string }>,
  prefix: string,
  entries: DiffEntry[],
): void {
  const allKeys = new Set([...Object.keys(oldMap), ...Object.keys(newMap)])

  for (const key of allKeys) {
    const oldVal = oldMap[key]
    const newVal = newMap[key]

    if (!oldVal && newVal) {
      entries.push({ type: "add", path: `${prefix}.${key}`, new: newVal })
    } else if (oldVal && !newVal) {
      entries.push({ type: "remove", path: `${prefix}.${key}`, old: oldVal })
    } else if (
      oldVal &&
      newVal &&
      (oldVal.model !== newVal.model || oldVal.variant !== newVal.variant)
    ) {
      entries.push({ type: "modify", path: `${prefix}.${key}`, old: oldVal, new: newVal })
    }
  }
}
