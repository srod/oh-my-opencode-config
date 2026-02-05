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

function extractSemver(value: string): SemverParts | null {
  const match = value.match(/\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?/u)
  if (!match) {
    return null
  }
  return parseSemver(match[0])
}

function isNumericIdentifier(value: string): boolean {
  return /^\d+$/u.test(value)
}

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

function compareSemver(a: SemverParts, b: SemverParts): number {
  if (a.major !== b.major) return a.major - b.major
  if (a.minor !== b.minor) return a.minor - b.minor
  if (a.patch !== b.patch) return a.patch - b.patch

  if (a.prerelease === null && b.prerelease === null) return 0
  if (a.prerelease === null) return 1
  if (b.prerelease === null) return -1

  return comparePrerelease(a.prerelease, b.prerelease)
}

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
