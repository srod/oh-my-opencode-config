import path from "node:path"
import { execaSync } from "../utils/execa.js"
import { existsSync } from "../utils/fs-sync.js"
import { PROJECT_CONFIG_REL_PATH, USER_CONFIG_FULL_PATH } from "./paths.js"

export function discoverConfigPath(): string | null {
  const cwdConfigPath = path.join(process.cwd(), PROJECT_CONFIG_REL_PATH)
  if (existsSync(cwdConfigPath)) {
    return cwdConfigPath
  }

  try {
    const { stdout: gitRoot } = execaSync("git", ["rev-parse", "--show-toplevel"])
    if (gitRoot) {
      const gitRootConfigPath = path.join(gitRoot, PROJECT_CONFIG_REL_PATH)
      if (existsSync(gitRootConfigPath)) {
        return gitRootConfigPath
      }
    }
  } catch {}

  if (existsSync(USER_CONFIG_FULL_PATH)) {
    return USER_CONFIG_FULL_PATH
  }

  return null
}
