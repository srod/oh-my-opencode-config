function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null) {
    return false
  }
  if (Array.isArray(value)) {
    return false
  }
  const proto = Object.getPrototypeOf(value)
  return proto === Object.prototype || proto === null
}

function hasOwnKey(obj: Record<string, unknown>, key: string): boolean {
  return Object.hasOwn(obj, key)
}

export function deepMerge(base: unknown, override: unknown): unknown {
  if (isPlainObject(base) && isPlainObject(override)) {
    const result: Record<string, unknown> = {}
    const keys = new Set([...Object.keys(base), ...Object.keys(override)])

    for (const key of keys) {
      if (hasOwnKey(override, key)) {
        const overrideValue = override[key]
        const baseValue = base[key]
        if (isPlainObject(baseValue) && isPlainObject(overrideValue)) {
          result[key] = deepMerge(baseValue, overrideValue)
        } else {
          result[key] = overrideValue
        }
      } else {
        result[key] = base[key]
      }
    }

    return result
  }

  if (override === undefined) {
    return base
  }

  return override
}
