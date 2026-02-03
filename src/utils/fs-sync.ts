import fs from "node:fs"

type ExistsSync = typeof fs.existsSync
type ExistsSyncPath = Parameters<ExistsSync>[0]

let existsSyncImpl: ExistsSync = fs.existsSync

export function existsSync(path: ExistsSyncPath): boolean {
  return existsSyncImpl(path)
}

export function setExistsSync(next: ExistsSync): void {
  existsSyncImpl = next
}

export function resetExistsSync(): void {
  existsSyncImpl = fs.existsSync
}
