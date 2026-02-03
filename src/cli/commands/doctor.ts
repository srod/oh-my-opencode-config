import path from "node:path"
import { intro, outro, spinner } from "@clack/prompts"
import { $ } from "bun"
import chalk from "chalk"
import { z } from "zod"
import { loadConfig } from "#config/loader.js"
import { MODELS_CACHE_PATH, OPENCODE_CONFIG_PATH } from "#config/paths.js"
import { resolveConfigPath } from "#config/resolve.js"
import { loadCustomModels, loadModelsCache, mergeModelsCache } from "#models/parser.js"
import { colorizeAgent } from "#types/colors.js"
import type { Config, Model, ModelsCache } from "#types/index.js"
import { AGENT_REQUIREMENTS, DYNAMIC_AGENTS } from "#types/requirements.js"
import { printBlank, printLine, printSeparator } from "#utils/output.js"
import { validateModelForAgent } from "#validation/capabilities.js"
import type { BaseCommandOptions } from "#cli/types.js"

type IssueSeverity = "error" | "warning" | "info"

const PackageJsonSchema = z.object({
  version: z.string(),
})

interface Issue {
  severity: IssueSeverity
  category: string
  message: string
  suggestion?: string
  autoFixable?: boolean
}

interface ModelAssignment {
  name: string
  model: string
  variant?: string
}

interface DiagnosticReport {
  healthy: boolean
  issues: Issue[]
  stats: {
    errors: number
    warnings: number
    info: number
  }
  versions: {
    opencode: string | null
    ohMyOpencode: string | null
  }
  summary: {
    agentsConfigured: number
    agentsTotal: number
    categoriesConfigured: number
    overrides: number
  }
  assignments: {
    agents: ModelAssignment[]
    categories: ModelAssignment[]
  }
  cache: {
    exists: boolean
    age: number | null
    outdated: boolean
  }
  config: {
    path: string
    valid: boolean
  }
  agents: {
    total: number
    configured: number
    withIssues: number
  }
}

const CACHE_MAX_AGE_DAYS = 7
const MS_PER_DAY = 24 * 60 * 60 * 1000

function formatDuration(ms: number): string {
  const minutes = Math.floor(ms / (60 * 1000))
  const hours = Math.floor(ms / (60 * 60 * 1000))
  const days = Math.floor(ms / MS_PER_DAY)

  if (days > 0) return `${days} day${days > 1 ? "s" : ""} ago`
  if (hours > 0) return `${hours} hour${hours > 1 ? "s" : ""} ago`
  if (minutes > 0) return `${minutes} minute${minutes > 1 ? "s" : ""} ago`
  return "just now"
}

function splitModelReference(value: string): { provider: string; modelId: string } | null {
  const slashIndex = value.indexOf("/")
  if (slashIndex <= 0 || slashIndex === value.length - 1) {
    return null
  }
  return { provider: value.slice(0, slashIndex), modelId: value.slice(slashIndex + 1) }
}

function collectAssignments(
  entries: Record<string, { model?: string; variant?: string }> | undefined,
): ModelAssignment[] {
  if (!entries) {
    return []
  }

  const assignments: ModelAssignment[] = []

  for (const [name, value] of Object.entries(entries)) {
    if (typeof value.model !== "string" || value.model.length === 0) {
      continue
    }
    assignments.push({
      name,
      model: value.model,
      variant: typeof value.variant === "string" ? value.variant : undefined,
    })
  }

  return assignments.sort((a, b) => a.name.localeCompare(b.name))
}

async function readPackageVersion(packagePath: string): Promise<string | null> {
  const file = Bun.file(packagePath)
  if (!(await file.exists())) {
    return null
  }

  try {
    const content = await file.text()
    const parsed = PackageJsonSchema.safeParse(JSON.parse(content))
    if (!parsed.success) {
      return null
    }
    const version = parsed.data.version.trim()
    return version.length > 0 ? version : null
  } catch {
    return null
  }
}

async function getOhMyOpencodeVersion(opencodeConfigPath?: string): Promise<string | null> {
  const configPath = opencodeConfigPath ?? OPENCODE_CONFIG_PATH
  const configDir = path.dirname(configPath)
  const configDirPackage = path.join(configDir, "node_modules", "oh-my-opencode", "package.json")
  const fromConfigDir = await readPackageVersion(configDirPackage)
  if (fromConfigDir) {
    return fromConfigDir
  }

  const binPath = Bun.which("oh-my-opencode")
  if (binPath) {
    const binDir = path.dirname(binPath)
    const binPackage = path.join(binDir, "..", "oh-my-opencode", "package.json")
    const fromBin = await readPackageVersion(binPackage)
    if (fromBin) {
      return fromBin
    }
  }

  return null
}

async function checkModelCache(): Promise<{
  exists: boolean
  age: number | null
  outdated: boolean
}> {
  const file = Bun.file(MODELS_CACHE_PATH)
  const exists = await file.exists()

  if (!exists) {
    return { exists: false, age: null, outdated: true }
  }

  try {
    const stat = await file.stat()
    const age = Date.now() - stat.mtime.getTime()
    const ageInDays = age / MS_PER_DAY
    const outdated = ageInDays > CACHE_MAX_AGE_DAYS

    return { exists: true, age, outdated }
  } catch {
    return { exists: true, age: null, outdated: true }
  }
}

async function refreshCache(): Promise<boolean> {
  try {
    const result = await $`opencode models --refresh`.text()
    return result.length > 0
  } catch {
    return false
  }
}

async function getOpencodeVersion(): Promise<string | null> {
  const opencodePath = Bun.which("opencode")
  if (!opencodePath) {
    return null
  }

  try {
    const output = await $`opencode --version`.text()
    const firstLine = output.split(/\r?\n/u)[0] ?? ""
    const trimmed = firstLine.trim()
    return trimmed.length > 0 ? trimmed : null
  } catch {
    return null
  }
}

function checkConfigSchema(config: Config): Issue[] {
  const issues: Issue[] = []

  if (!config.agents) {
    issues.push({
      severity: "warning",
      category: "config",
      message: "No agents configured in config file",
      suggestion: "Run `oh-my-opencode-config configure agents` to set up agents",
      autoFixable: false,
    })
  }

  const agents = config.agents || {}

  for (const [agentName, agentConfig] of Object.entries(agents)) {
    // Dynamic agents (e.g. sisyphus-junior) are spawned at runtime, skip validation
    if (DYNAMIC_AGENTS.has(agentName)) continue

    // Detect defunct/unknown agents not in requirements
    if (!(agentName in AGENT_REQUIREMENTS)) {
      issues.push({
        severity: "warning",
        category: "config",
        message: `Agent "${agentName}" not recognized — may have been removed from oh-my-opencode`,
        suggestion: `Remove "${agentName}" from your config to clean up`,
        autoFixable: false,
      })
      continue
    }

    if (!agentConfig.model) {
      issues.push({
        severity: "error",
        category: "config",
        message: `Agent "${agentName}" has no model assigned`,
        suggestion: "Run `oh-my-opencode-config configure agents`",
        autoFixable: false,
      })
      continue
    }

    const modelRef = splitModelReference(agentConfig.model)
    if (!modelRef) {
      issues.push({
        severity: "error",
        category: "config",
        message: `Agent "${agentName}" has invalid model format: "${agentConfig.model}"`,
        suggestion: "Model should be in format: provider/model-id",
        autoFixable: false,
      })
    }
  }

  return issues
}

function checkAgentCapabilities(config: Config, mergedCache: ModelsCache): Issue[] {
  const issues: Issue[] = []
  const agents = config.agents || {}

  for (const agentName of Object.keys(AGENT_REQUIREMENTS)) {
    const agentConfig = agents[agentName]

    if (!agentConfig || !agentConfig.model) {
      issues.push({
        severity: "warning",
        category: "agent",
        message: `Agent "${agentName}" not configured`,
        suggestion: "Run `oh-my-opencode-config configure agents`",
        autoFixable: false,
      })
      continue
    }

    const modelRef = splitModelReference(agentConfig.model)
    if (!modelRef) {
      continue
    }
    const { provider, modelId } = modelRef

    if (!provider || !modelId) {
      continue
    }

    const model: Model | undefined = mergedCache[provider]?.models[modelId]

    if (!model) {
      issues.push({
        severity: "error",
        category: "agent",
        message: `Agent "${agentName}" model "${agentConfig.model}" not found in cache`,
        suggestion: "Run `oh-my-opencode-config refresh` to update model cache",
        autoFixable: true,
      })
      continue
    }

    const validation = validateModelForAgent(model, agentName)

    if (!validation.valid && validation.missing.length > 0) {
      issues.push({
        severity: "error",
        category: "agent",
        message: `Agent "${agentName}" model missing required capability: "${validation.missing.join(", ")}"`,
        suggestion: `Assign a model with ${validation.missing.join(", ")} capability`,
        autoFixable: false,
      })
    }
  }

  return issues
}

function generateReport(
  cacheStatus: { exists: boolean; age: number | null; outdated: boolean },
  configPath: string,
  configValid: boolean,
  issues: Issue[],
  versions: { opencode: string | null; ohMyOpencode: string | null },
  summary: {
    agentsConfigured: number
    agentsTotal: number
    categoriesConfigured: number
    overrides: number
  },
  assignments: { agents: ModelAssignment[]; categories: ModelAssignment[] },
): DiagnosticReport {
  const errors = issues.filter((i) => i.severity === "error").length
  const warnings = issues.filter((i) => i.severity === "warning").length
  const info = issues.filter((i) => i.severity === "info").length

  return {
    healthy: errors === 0 && !cacheStatus.outdated,
    issues,
    stats: { errors, warnings, info },
    versions,
    summary,
    assignments,
    cache: cacheStatus,
    config: { path: configPath, valid: configValid },
    agents: {
      total: Object.keys(AGENT_REQUIREMENTS).length,
      configured: 0,
      withIssues: 0,
    },
  }
}

export function printTextReport(
  report: DiagnosticReport,
  options?: { showIntroOutro?: boolean },
): void {
  const showIntroOutro = options?.showIntroOutro ?? true

  if (showIntroOutro) {
    intro(chalk.bold("🔍 Diagnosing configuration..."))
  } else {
    printBlank()
    printLine(chalk.bold("🔍 Diagnosing configuration..."))
  }

  printBlank()

  if (report.cache.exists) {
    if (report.cache.outdated) {
      const ageText = report.cache.age !== null ? formatDuration(report.cache.age) : "unknown"
      printLine(`${chalk.yellow("⚠")} Model cache: Outdated (last updated ${ageText})`)
      printLine(
        `  ${chalk.gray("→ Suggestion: Run `oh-my-opencode-config refresh` or use --fix flag")}`,
      )
    } else {
      const ageText = report.cache.age !== null ? formatDuration(report.cache.age) : "recently"
      printLine(`${chalk.green("✓")} Model cache: Found (last updated ${ageText})`)
    }
  } else {
    printLine(`${chalk.red("✗")} Model cache: Missing`)
    printLine(`  ${chalk.gray("→ Suggestion: Run `opencode models --refresh` or use --fix flag")}`)
  }

  if (report.config.valid) {
    printLine(`${chalk.green("✓")} Config file: Valid`)
  } else {
    printLine(`${chalk.red("✗")} Config file: Invalid`)
  }

  printLine(chalk.dim(`  (${report.config.path})`))
  const opencodeSymbol = report.versions.opencode ? chalk.green("✓") : chalk.yellow("⚠")
  printLine(`${opencodeSymbol} opencode: ${report.versions.opencode ?? "not found in PATH"}`)
  const ohMySymbol = report.versions.ohMyOpencode ? chalk.green("✓") : chalk.yellow("⚠")
  printLine(`${ohMySymbol} oh-my-opencode: ${report.versions.ohMyOpencode ?? "not found"}`)

  printBlank()
  printLine(chalk.bold("Configuration summary"))
  printLine(
    `${chalk.green("✓")} Agents configured: ${report.summary.agentsConfigured}/${report.summary.agentsTotal}`,
  )
  printLine(`${chalk.green("✓")} Categories configured: ${report.summary.categoriesConfigured}`)
  printLine(`${chalk.green("✓")} Overrides: ${report.summary.overrides}`)

  printBlank()
  printLine(chalk.bold("Configured models"))
  if (report.assignments.agents.length === 0) {
    printLine(chalk.dim("  Agents: none"))
  } else {
    printLine(chalk.dim("  Agents:"))
    for (const assignment of report.assignments.agents) {
      const variant = assignment.variant ? ` (${assignment.variant})` : ""
      printLine(`  ● ${colorizeAgent(assignment.name)}: ${assignment.model}${variant}`)
    }
  }
  if (report.assignments.categories.length === 0) {
    printLine(chalk.dim("  Categories: none"))
  } else {
    printLine(chalk.dim("  Categories:"))
    for (const assignment of report.assignments.categories) {
      const variant = assignment.variant ? ` (${assignment.variant})` : ""
      printLine(`  ● ${assignment.name}: ${assignment.model}${variant}`)
    }
  }

  const agentIssues = report.issues.filter((i) => i.category === "agent")
  const configIssues = report.issues.filter((i) => i.category === "config")

  for (const agentName of Object.keys(AGENT_REQUIREMENTS)) {
    const issues = agentIssues.filter((i) => i.message.includes(`"${agentName}"`))

    if (issues.length === 0) {
      printLine(`${chalk.green("✓")} Agent "${colorizeAgent(agentName)}": Properly configured`)
    } else {
      for (const issue of issues) {
        const symbol = issue.severity === "error" ? chalk.red("✗") : chalk.yellow("⚠")
        printLine(`${symbol} Agent "${colorizeAgent(agentName)}": ${issue.message}`)
        if (issue.suggestion) {
          printLine(`  ${chalk.gray(`→ Suggestion: ${issue.suggestion}`)}`)
        }
      }
    }
  }

  for (const issue of configIssues) {
    const symbol = issue.severity === "error" ? chalk.red("✗") : chalk.yellow("⚠")
    printLine(`${symbol} Config: ${issue.message}`)
    if (issue.suggestion) {
      printLine(`  ${chalk.gray(`→ Suggestion: ${issue.suggestion}`)}`)
    }
  }

  printSeparator()

  if (report.stats.errors === 0 && report.stats.warnings === 0) {
    printLine(chalk.green("All checks passed! Configuration is healthy."))
  } else {
    const parts: string[] = []
    if (report.stats.errors > 0) {
      parts.push(
        `${chalk.red(report.stats.errors.toString())} error${report.stats.errors > 1 ? "s" : ""}`,
      )
    }
    if (report.stats.warnings > 0) {
      parts.push(
        `${chalk.yellow(report.stats.warnings.toString())} warning${report.stats.warnings > 1 ? "s" : ""}`,
      )
    }
    printLine(`Issues found: ${parts.join(", ")}`)
  }

  if (showIntroOutro) {
    outro("")
  }
}

export async function buildDoctorReport(
  options: Pick<BaseCommandOptions, "config" | "opencodeConfig"> & { fix?: boolean },
): Promise<DiagnosticReport> {
  const configPath = resolveConfigPath(options.config)
  const opencodeVersion = await getOpencodeVersion()
  const ohMyOpencodeVersion = await getOhMyOpencodeVersion(options.opencodeConfig)

  const cacheStatus = await checkModelCache()

  if (options.fix && (!cacheStatus.exists || cacheStatus.outdated)) {
    const s = spinner()
    s.start("Refreshing model cache...")
    const refreshed = await refreshCache()
    if (refreshed) {
      s.stop("Model cache refreshed")
    } else {
      s.stop("Failed to refresh model cache")
    }
  }

  let config: Config
  let configValid = true

  try {
    config = await loadConfig(configPath)
  } catch {
    config = { agents: {}, categories: {} }
    configValid = false
  }

  let modelsCache: ModelsCache = {}
  let customModelsCache: ModelsCache = {}

  try {
    modelsCache = await loadModelsCache()
    customModelsCache = await loadCustomModels(options.opencodeConfig)
  } catch {}

  const mergedCache = mergeModelsCache(modelsCache, customModelsCache)

  const issues: Issue[] = []

  if (!cacheStatus.exists) {
    issues.push({
      severity: "error",
      category: "cache",
      message: "Model cache is missing",
      suggestion: options.fix
        ? "Cache refresh attempted"
        : "Run `oh-my-opencode-config refresh` or use --fix flag",
      autoFixable: true,
    })
  } else if (cacheStatus.outdated) {
    issues.push({
      severity: "warning",
      category: "cache",
      message: "Model cache is outdated (> 7 days old)",
      suggestion: options.fix
        ? "Cache refresh attempted"
        : "Run `oh-my-opencode-config refresh` or use --fix flag",
      autoFixable: true,
    })
  }

  if (!configValid) {
    issues.push({
      severity: "error",
      category: "config",
      message: "Config file is invalid or corrupted",
      suggestion: "Run `oh-my-opencode-config reset` to restore defaults",
      autoFixable: false,
    })
  }

  issues.push(...checkConfigSchema(config))
  issues.push(...checkAgentCapabilities(config, mergedCache))

  const assignments = {
    agents: collectAssignments(config.agents),
    categories: collectAssignments(config.categories),
  }
  const summary = {
    agentsConfigured: assignments.agents.length,
    agentsTotal: Object.keys(AGENT_REQUIREMENTS).length,
    categoriesConfigured: assignments.categories.length,
    overrides: assignments.agents.length + assignments.categories.length,
  }

  const report = generateReport(
    cacheStatus,
    configPath,
    configValid,
    issues,
    {
      opencode: opencodeVersion,
      ohMyOpencode: ohMyOpencodeVersion,
    },
    summary,
    assignments,
  )

  return report
}

export async function doctorCommand(
  options: Pick<BaseCommandOptions, "config" | "json" | "opencodeConfig"> & { fix?: boolean },
): Promise<void> {
  const report = await buildDoctorReport(options)

  if (options.json) {
    printLine(JSON.stringify(report, null, 2))
  } else {
    printTextReport(report)
  }

  process.exit(report.healthy ? 0 : 1)
}
