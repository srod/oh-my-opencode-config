import path from "node:path"

export function pathDirname(configPath: string): string {
  return path.dirname(configPath)
}

export function validateProfileName(value: string | undefined): string | undefined {
  if (!value || value.length === 0) {
    return "Profile name is required"
  }
  if (value.length > 50) {
    return "Profile name must be 50 characters or less"
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(value)) {
    return "Profile name must contain only letters, numbers, hyphens, and underscores"
  }
  return undefined
}
