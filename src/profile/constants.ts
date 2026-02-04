/**
 * Shared constants for profile name validation and file handling.
 */

// Profile name validation pattern: alphanumeric + hyphen/underscore, 1-32 chars
export const PROFILE_NAME_REGEX = /^[a-zA-Z0-9_-]{1,32}$/

// Maximum length for profile names
export const PROFILE_NAME_MAX_LENGTH = 32

// Reserved profile names that cannot be used
export const RESERVED_PROFILE_NAMES = new Set([
  "default",
  "backup",
  "temp",
  "current",
  "oh-my-opencode",
])

// Config file name constant
export const CONFIG_FILE_NAME = "oh-my-opencode.json"

// Template file name for profile defaults
export const PROFILE_TEMPLATE_FILE_NAME = "oh-my-opencode.template.json"
