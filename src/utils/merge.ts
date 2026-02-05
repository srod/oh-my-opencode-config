/**
 * Determines whether a value is a plain JavaScript object.
 *
 * @returns `true` if `value` is a non-null, non-array object whose prototype is `Object.prototype` or `null`, `false` otherwise.
 */
const BLOCKED_KEYS = new Set(["__proto__", "constructor", "prototype"])

/**
 * Determines whether a value is a plain object (an object that is not an array or null and whose prototype is `Object.prototype` or `null`).
 *
 * @returns `true` if `value` is a plain object (not `null` or an array) with prototype `Object.prototype` or `null`, `false` otherwise.
 */
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

/**
 * Determine whether an object has its own (non-inherited) property with the given key.
 *
 * @param obj - The object to inspect
 * @param key - The property name to check for on `obj`
 * @returns `true` if `obj` has an own property named `key`, `false` otherwise
 */
function hasOwnKey(obj: Record<string, unknown>, key: string): boolean {
  return Object.hasOwn(obj, key)
}

/**
 * Recursively merges two values, preferring values from `override`.
 *
 * If both `base` and `override` are plain objects, returns a new object containing the union of their own keys; for keys present in both, if both corresponding values are plain objects they are merged recursively, otherwise the value from `override` is used. If `override` is `undefined`, returns `base`; if either value is not a plain object and `override` is not `undefined`, returns `override`.
 *
 * @param base - The base value to merge from.
 * @param override - The value whose properties take precedence when merging.
 * @returns The merged value: a new object when both inputs are plain objects, otherwise `base` or `override` according to the rules above.
 */
export function deepMerge(base: unknown, override: unknown): unknown {
  if (isPlainObject(base) && isPlainObject(override)) {
    const result: Record<string, unknown> = {}
    const keys = new Set([...Object.keys(base), ...Object.keys(override)])

    for (const key of keys) {
      if (BLOCKED_KEYS.has(key)) {
        continue
      }
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