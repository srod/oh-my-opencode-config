import { discoverConfigPath } from "./discover.js"
import { USER_CONFIG_FULL_PATH } from "./paths.js"

export interface ResolveConfigPathDeps {
  discoverConfigPath?: () => string | null
  userConfigFullPath?: string
}

export function resolveConfigPath(
  configOption?: string | null,
  deps: ResolveConfigPathDeps = {},
): string {
  const discover = deps.discoverConfigPath ?? discoverConfigPath
  const userPath = deps.userConfigFullPath ?? USER_CONFIG_FULL_PATH
  return configOption || discover() || userPath
}
