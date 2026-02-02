import { discoverConfigPath } from "./discover.js"
import { USER_CONFIG_FULL_PATH } from "./paths.js"

export function resolveConfigPath(configOption?: string | null): string {
  return configOption || discoverConfigPath() || USER_CONFIG_FULL_PATH
}
