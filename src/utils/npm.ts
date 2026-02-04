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
}

export interface NpmUpdateReport {
  opencode: NpmUpdateStatus
  ohMyOpencode: NpmUpdateStatus
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

function compareSemver(a: SemverParts, b: SemverParts): number {
  if (a.major !== b.major) return a.major - b.major
  if (a.minor !== b.minor) return a.minor - b.minor
  if (a.patch !== b.patch) return a.patch - b.patch

  if (a.prerelease === null && b.prerelease === null) return 0
  if (a.prerelease === null) return 1
  if (b.prerelease === null) return -1

  return a.prerelease.localeCompare(b.prerelease)
}

function buildUpdateStatus(current: string | null, latest: string | null): NpmUpdateStatus {
  if (!current || !latest) {
    return { latest, updateAvailable: null }
  }

  const currentSemver = extractSemver(current)
  const latestSemver = extractSemver(latest)

  if (!currentSemver || !latestSemver) {
    return { latest, updateAvailable: null }
  }

  return {
    latest,
    updateAvailable: compareSemver(currentSemver, latestSemver) < 0,
  }
}

async function getLatestNpmVersion(packageName: string): Promise<string | null> {
  try {
    const response = await fetch(`https://registry.npmjs.org/${packageName}`)
    if (!response.ok) {
      return null
    }
    const data: unknown = await response.json()
    const parsed = NpmRegistrySchema.safeParse(data)
    if (!parsed.success) {
      return null
    }
    const latest = parsed.data["dist-tags"].latest.trim()
    return latest.length > 0 ? latest : null
  } catch {
    return null
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
