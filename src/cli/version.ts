import { readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { z } from "zod"

const PackageJsonSchema = z.object({ version: z.string() })

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const packageJsonPath = path.resolve(currentDir, "..", "..", "package.json")
const raw: unknown = JSON.parse(readFileSync(packageJsonPath, "utf-8"))

export const CLI_VERSION = PackageJsonSchema.parse(raw).version
