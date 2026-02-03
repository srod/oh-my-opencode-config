import path from "node:path"
import { execaSync } from "#utils/execa.js"
import { existsSync } from "#utils/fs-sync.js"
import { PROJECT_CONFIG_REL_PATH, USER_CONFIG_FULL_PATH } from "./paths.js"

type ExistsSyncLike = (path: string) => boolean
type ExecaSyncLike = (file: string | URL, args?: readonly string[]) => { stdout: unknown }

export interface DiscoverConfigPathDeps {
  existsSync?: ExistsSyncLike
  execaSync?: ExecaSyncLike
  projectConfigRelPath?: string
  userConfigFullPath?: string
}

export function discoverConfigPath(deps: DiscoverConfigPathDeps = {}): string | null {
  const exists = deps.existsSync ?? existsSync
  const exec = deps.execaSync ?? execaSync
  const projectRelPath = deps.projectConfigRelPath ?? PROJECT_CONFIG_REL_PATH
  const userFullPath = deps.userConfigFullPath ?? USER_CONFIG_FULL_PATH
  const cwdConfigPath = path.join(process.cwd(), projectRelPath)
  if (exists(cwdConfigPath)) {
    return cwdConfigPath
  }

  try {
    const { stdout } = exec("git", ["rev-parse", "--show-toplevel"])
    const gitRoot = typeof stdout === "string" ? stdout : ""
    if (gitRoot) {
      const gitRootConfigPath = path.join(gitRoot, projectRelPath)
      if (exists(gitRootConfigPath)) {
        return gitRootConfigPath
      }
    }
  } catch {}

  if (exists(userFullPath)) {
    return userFullPath
  }

  return null
}
