import path from "node:path"
import { existsSync } from "#utils/fs-sync.js"
import { PROJECT_CONFIG_REL_PATH, USER_CONFIG_FULL_PATH } from "./paths.js"

type ExistsSyncLike = (path: string) => boolean

export interface DiscoverConfigPathDeps {
  existsSync?: ExistsSyncLike
  projectConfigRelPath?: string
  userConfigFullPath?: string
}

export function discoverConfigPath(deps: DiscoverConfigPathDeps = {}): string | null {
  const exists = deps.existsSync ?? existsSync
  const projectRelPath = deps.projectConfigRelPath ?? PROJECT_CONFIG_REL_PATH
  const userFullPath = deps.userConfigFullPath ?? USER_CONFIG_FULL_PATH
  const cwdConfigPath = path.join(process.cwd(), projectRelPath)
  if (exists(cwdConfigPath)) {
    return cwdConfigPath
  }

  if (exists(userFullPath)) {
    return userFullPath
  }

  return null
}
