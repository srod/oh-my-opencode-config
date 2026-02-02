export class CacheMissingError extends Error {
  constructor(path: string) {
    super(`Models cache missing at ${path}. Please run 'opencode models --refresh'`)
    this.name = "CacheMissingError"
  }
}

export class CacheCorruptedError extends Error {
  constructor(message: string) {
    super(`Models cache corrupted: ${message}`)
    this.name = "CacheCorruptedError"
  }
}

export class PermissionDeniedError extends Error {
  constructor(path: string, operation: string) {
    super(
      `Permission denied: Cannot ${operation} ${path}. Try running with sudo or fixing permissions.`,
    )
    this.name = "PermissionDeniedError"
  }
}

export class ConcurrentModificationError extends Error {
  constructor(path: string) {
    super(`Concurrent modification detected for ${path}. Please try again.`)
    this.name = "ConcurrentModificationError"
  }
}

export class InvalidConfigError extends Error {
  constructor(message: string) {
    super(`Invalid configuration: ${message}`)
    this.name = "InvalidConfigError"
  }
}

export class GracefulExitError extends Error {
  constructor() {
    super("Operation cancelled by user")
    this.name = "GracefulExitError"
  }
}

export class CacheExpiredError extends Error {
  constructor(ageInDays: number) {
    super(`Models cache is ${ageInDays.toFixed(1)} days old. Warning: Data may be stale.`)
    this.name = "CacheExpiredError"
  }
}
