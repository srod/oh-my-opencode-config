import { InvalidConfigError, PermissionDeniedError } from "#errors/types.js"
import { type Config, ConfigSchema } from "#types/config.js"
import { isErrnoException } from "#utils/fs.js"
import { DEFAULT_CONFIG } from "./defaults.js"

export async function loadConfig(path: string): Promise<Config> {
  const file = Bun.file(path)

  if (!(await file.exists())) {
    return DEFAULT_CONFIG
  }

  try {
    const content = await file.text()
    const json = JSON.parse(content)
    const result = ConfigSchema.safeParse(json)

    if (!result.success) {
      const issues = result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(", ")
      throw new InvalidConfigError(`${path}: ${issues}`)
    }

    return result.data
  } catch (error) {
    if (error instanceof InvalidConfigError) throw error

    if (error instanceof SyntaxError) {
      throw new InvalidConfigError(`Malformed JSON in ${path}: ${error.message}`)
    }

    if (isErrnoException(error) && error.code === "EACCES") {
      throw new PermissionDeniedError(path, "read")
    }

    throw error
  }
}
