import {
  execa as realExeca,
  execaSync as realExecaSync,
  type SyncOptions,
  type SyncResult,
} from "execa"

type ExecaSyncImpl = (
  file: string | URL,
  argsOrOptions?: readonly string[] | SyncOptions,
  options?: SyncOptions,
) => SyncResult

function isStringArray(
  value: readonly string[] | SyncOptions | undefined,
): value is readonly string[] {
  return Array.isArray(value)
}

const defaultExecaSync: ExecaSyncImpl = (file, argsOrOptions, options) => {
  if (isStringArray(argsOrOptions)) {
    if (options) {
      return realExecaSync(file, argsOrOptions, options)
    }
    return realExecaSync(file, argsOrOptions)
  }
  if (argsOrOptions) {
    return realExecaSync(file, argsOrOptions)
  }
  return realExecaSync(file)
}

let execaSyncImpl: ExecaSyncImpl = defaultExecaSync

export function execaSync(
  file: string | URL,
  argsOrOptions?: readonly string[] | SyncOptions,
  options?: SyncOptions,
): SyncResult {
  return execaSyncImpl(file, argsOrOptions, options)
}

export function setExecaSync(next: ExecaSyncImpl): void {
  execaSyncImpl = next
}

export function resetExecaSync(): void {
  execaSyncImpl = defaultExecaSync
}

export { realExeca as execa }
