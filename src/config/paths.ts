import os from "node:os"
import path from "node:path"

export const CONFIG_FILE_NAME = "oh-my-opencode.json"
export const PROJECT_CONFIG_DIR = ".opencode"
export const USER_CONFIG_DIR = path.join(".config", "opencode")

export const PROJECT_CONFIG_REL_PATH = path.join(PROJECT_CONFIG_DIR, CONFIG_FILE_NAME)
export const USER_CONFIG_FULL_PATH = path.join(os.homedir(), USER_CONFIG_DIR, CONFIG_FILE_NAME)

export const OPENCODE_CONFIG_DIR = path.join(os.homedir(), ".config", "opencode")
export const OPENCODE_CONFIG_FILE = "opencode.json"
export const OPENCODE_CONFIG_PATH = path.join(OPENCODE_CONFIG_DIR, OPENCODE_CONFIG_FILE)

// opencode's cache dir — we only READ models.json from here
export const OPENCODE_CACHE_DIR = path.join(".cache", "opencode")
export const MODELS_CACHE_FILE = "models.json"
export const MODELS_CACHE_PATH = path.join(os.homedir(), OPENCODE_CACHE_DIR, MODELS_CACHE_FILE)

// Our own cache dir for data we write
export const OWN_CACHE_DIR = path.join(".cache", "oh-my-opencode-config")

export const AVAILABLE_MODELS_CACHE_FILE = "available-models.json"
export const AVAILABLE_MODELS_CACHE_PATH = path.join(
  os.homedir(),
  OWN_CACHE_DIR,
  AVAILABLE_MODELS_CACHE_FILE,
)
export const AVAILABLE_MODELS_CACHE_TTL_MS = 60 * 60 * 1000 // 1 hour
export const UPDATE_NOTIFIER_CACHE_FILE = "update-notifier.json"
export const UPDATE_NOTIFIER_CACHE_PATH = path.join(
  os.homedir(),
  OWN_CACHE_DIR,
  UPDATE_NOTIFIER_CACHE_FILE,
)
export const UPDATE_NOTIFIER_CACHE_TTL_MS = 24 * 60 * 60 * 1000 // 24 hours
