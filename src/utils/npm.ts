import { z } from "zod"

const NpmRegistrySchema = z.object({
  "dist-tags": z.object({
    latest: z.string(),
  }),
})

interface SemverParts {
  major: number
  minor: number
  patch: number
  prerelease: string | null
}

export interface NpmUpdateStatus {
  latest: string | null
  updateAvailable: boolean | null
  error: string | null
}

export interface NpmUpdateReport {
  opencode: NpmUpdateStatus
  ohMyOpencode: NpmUpdateStatus
}

interface NpmRegistryResult {
  latest: string | null
  error: string | null
}

/**
 * Parses a full semantic version string (optionally prefixed with `v` and with an optional prerelease) into its components.
 *
 * @param value - The version string to parse (e.g., "v1.2.3" or "1.2.3-alpha.1")
 * @returns A `SemverParts` object with `major`, `minor`, `patch`, and `prerelease` (string or `null`) when parsing succeeds; `null` if the input is not a valid semantic version
 */
function parseSemver(value: string): SemverParts | null {
  const match = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/u.exec(value)
  if (!match) {
    return null
  }

  const major = Number(match[1])
  const minor = Number(match[2])
  const patch = Number(match[3])

  if (!Number.isFinite(major) || !Number.isFinite(minor) || !Number.isFinite(patch)) {
    return null
  }

  return {
    major,
    minor,
    patch,
    prerelease: typeof match[4] === "string" && match[4].length > 0 ? match[4] : null,
  }
}

/**
 * Extracts and parses the first semantic version substring found in `value`.
 *
 * @param value - Input string to search for a semantic version (e.g., "1.2.3" or "v1.2.3-alpha")
 * @returns A `SemverParts` object for the first matched semantic version, or `null` if no valid semver is found
 */
function extractSemver(value: string): SemverParts | null {
  const match = value.match(/\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?/u)
  if (!match) {
    return null
  }
  return parseSemver(match[0])
}

/**
 * Determines whether a string consists only of ASCII digits (0-9).
 *
 * @param value - The string to test
 * @returns `true` if `value` contains one or more digits and no other characters, `false` otherwise.
 */
function isNumericIdentifier(value: string): boolean {
  return /^\d+$/u.test(value)
}

/**
 * Compare two semver prerelease strings and determine their precedence.
 *
 * @param a - Prerelease string composed of dot-separated identifiers (for example, "alpha.1")
 * @param b - Prerelease string composed of dot-separated identifiers
 * @returns `-1` if `a` has lower precedence than `b`, `1` if `a` has higher precedence than `b`, `0` if they have equal precedence
 */
function comparePrerelease(a: string, b: string): number {
  const aParts = a.split(".")
  const bParts = b.split(".")
  const maxLength = Math.max(aParts.length, bParts.length)

  for (let i = 0; i < maxLength; i += 1) {
    const aPart = aParts[i]
    const bPart = bParts[i]

    if (aPart === undefined) {
      return -1
    }
    if (bPart === undefined) {
      return 1
    }
    if (aPart === bPart) {
      continue
    }

    const aIsNumeric = isNumericIdentifier(aPart)
    const bIsNumeric = isNumericIdentifier(bPart)

    if (aIsNumeric && bIsNumeric) {
      const aNum = Number(aPart)
      const bNum = Number(bPart)
      if (aNum !== bNum) {
        return aNum - bNum
      }
      continue
    }

    if (aIsNumeric) {
      return -1
    }
    if (bIsNumeric) {
      return 1
    }

    return aPart < bPart ? -1 : 1
  }

  return 0
}

/**
 * Compare two semantic version objects according to semver precedence rules.
 *
 * @returns A positive number if `a` has higher precedence than `b`, a negative number if `a` has lower precedence than `b`, or `0` if they are equal.
 */
function compareSemver(a: SemverParts, b: SemverParts): number {
  if (a.major !== b.major) return a.major - b.major
  if (a.minor !== b.minor) return a.minor - b.minor
  if (a.patch !== b.patch) return a.patch - b.patch

  if (a.prerelease === null && b.prerelease === null) return 0
  if (a.prerelease === null) return 1
  if (b.prerelease === null) return -1

  return comparePrerelease(a.prerelease, b.prerelease)
}

/**
 * Determine whether an update is available by comparing the provided current version to the registry latest.
 *
 * @param current - The current installed version string, or `null` if unknown.
 * @param latestResult - Registry lookup result containing `latest` (possibly `null`) and an `error` message (possibly `null`).
 * @returns An NpmUpdateStatus object with:
 *  - `latest`: the latest version string from the registry or `null`,
 *  - `updateAvailable`: `true` if `latest` is a newer semver than `current`, `false` if not, or `null` if the comparison cannot be determined,
 *  - `error`: an error message from the registry lookup or `null`.
 */
function buildUpdateStatus(
  current: string | null,
  latestResult: NpmRegistryResult,
): NpmUpdateStatus {
  if (!current || !latestResult.latest) {
    return {
      latest: latestResult.latest,
      updateAvailable: null,
      error: latestResult.error,
    }
  }

  const currentSemver = extractSemver(current)
  const latestSemver = extractSemver(latestResult.latest)

  if (!currentSemver || !latestSemver) {
    return {
      latest: latestResult.latest,
      updateAvailable: null,
      error: latestResult.error,
    }
  }

  return {
    latest: latestResult.latest,
    updateAvailable: compareSemver(currentSemver, latestSemver) < 0,
    error: latestResult.error,
  }
}

/**
 * Produce a user-facing message describing a fetch-related error.
 *
 * @param error - The caught error value to normalize into a message.
 * @returns `"request timed out"` if `error` is an `AbortError`; the trimmed `error.message` if `error` is an `Error` with a non-empty message; otherwise `"request failed"`.
 */
function buildFetchErrorMessage(error: unknown): string {
  if (error instanceof Error && error.name === "AbortError") {
    return "request timed out"
  }
  if (error instanceof Error) {
    const message = error.message.trim()
    return message.length > 0 ? message : "request failed"
  }
  return "request failed"
}

/**
 * Fetches the latest published version string for an npm package from the public registry.
 *
 * @returns `{ latest: string | null; error: string | null }` where `latest` is the registry's trimmed `dist-tags.latest` when available, and `error` is a short error message (for example: HTTP status like `HTTP 404`, `"invalid registry response"`, `"latest tag missing"`, or `"request timed out"`) or `null` when no error occurred.
 */
async function getLatestNpmVersion(packageName: string): Promise<NpmRegistryResult> {
  const controller = new AbortController()
  const timeoutMs = 4000
  const timeoutId = setTimeout(() => {
    controller.abort()
  }, timeoutMs)

  try {
    const response = await fetch(`https://registry.npmjs.org/${packageName}`, {
      signal: controller.signal,
    })
    if (!response.ok) {
      return { latest: null, error: `HTTP ${response.status}` }
    }
    const data: unknown = await response.json()
    const parsed = NpmRegistrySchema.safeParse(data)
    if (!parsed.success) {
      return { latest: null, error: "invalid registry response" }
    }
    const latest = parsed.data["dist-tags"].latest.trim()
    if (latest.length === 0) {
      return { latest: null, error: "latest tag missing" }
    }
    return { latest, error: null }
  } catch (error) {
    return { latest: null, error: buildFetchErrorMessage(error) }
  } finally {
    clearTimeout(timeoutId)
  }
}

export async function checkNpmUpdates(versions: {
  opencode: string | null
  ohMyOpencode: string | null
}): Promise<NpmUpdateReport> {
  const [opencodeLatest, ohMyOpencodeLatest] = await Promise.all([
    getLatestNpmVersion("opencode-ai"),
    getLatestNpmVersion("oh-my-opencode"),
  ])

  return {
    opencode: buildUpdateStatus(versions.opencode, opencodeLatest),
    ohMyOpencode: buildUpdateStatus(versions.ohMyOpencode, ohMyOpencodeLatest),
  }
}