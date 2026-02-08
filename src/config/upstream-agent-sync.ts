export type SyncedAgentConfig = {
  model: string
  variant?: string
}

export type AgentDefaults = Record<string, SyncedAgentConfig>

export type AgentDefaultDiff = {
  agent: string
  current: SyncedAgentConfig
  expected: SyncedAgentConfig
}

const AGENT_REQUIREMENTS_MARKER = "export const AGENT_MODEL_REQUIREMENTS"
const CATEGORY_REQUIREMENTS_MARKER = "export const CATEGORY_MODEL_REQUIREMENTS"

function findMatchingBrace(source: string, openIndex: number): number {
  let depth = 0
  let inString = false
  let quoteChar = ""
  let escaped = false

  for (let i = openIndex; i < source.length; i++) {
    const char = source[i]

    if (inString) {
      if (escaped) {
        escaped = false
        continue
      }
      if (char === "\\") {
        escaped = true
        continue
      }
      if (char === quoteChar) {
        inString = false
      }
      continue
    }

    if (char === '"' || char === "'" || char === "`") {
      inString = true
      quoteChar = char
      continue
    }

    if (char === "{") {
      depth += 1
      continue
    }

    if (char === "}") {
      depth -= 1
      if (depth === 0) {
        return i
      }
    }
  }

  throw new Error("Failed to match closing brace")
}

function findTopLevelObjectByMarker(source: string, marker: string): string {
  const markerIndex = source.indexOf(marker)
  if (markerIndex < 0) {
    throw new Error(`Could not find marker: ${marker}`)
  }

  const openIndex = source.indexOf("{", markerIndex)
  if (openIndex < 0) {
    throw new Error(`Could not find object start for marker: ${marker}`)
  }

  const closeIndex = findMatchingBrace(source, openIndex)
  return source.slice(openIndex + 1, closeIndex)
}

function parseObjectKey(
  source: string,
  startIndex: number,
): { key: string; next: number } | undefined {
  const firstChar = source.charAt(startIndex)
  if (firstChar === '"') {
    let i = startIndex + 1
    let key = ""
    let escaped = false
    for (; i < source.length; i++) {
      const char = source.charAt(i)
      if (escaped) {
        key += char
        escaped = false
        continue
      }
      if (char === "\\") {
        escaped = true
        continue
      }
      if (char === '"') {
        return { key, next: i + 1 }
      }
      key += char
    }
    return undefined
  }

  if (!/[A-Za-z_$]/.test(firstChar)) {
    return undefined
  }

  let i = startIndex
  while (i < source.length && /[A-Za-z0-9_$-]/.test(source.charAt(i))) {
    i += 1
  }
  return { key: source.slice(startIndex, i), next: i }
}

function extractTopLevelProperties(source: string): Array<{ key: string; value: string }> {
  const properties: Array<{ key: string; value: string }> = []
  let i = 0

  while (i < source.length) {
    while (i < source.length && /[\s,]/.test(source.charAt(i))) {
      i += 1
    }
    if (i >= source.length) {
      break
    }

    if (source.charAt(i) === "/" && source.charAt(i + 1) === "/") {
      while (i < source.length && source.charAt(i) !== "\n") {
        i += 1
      }
      continue
    }

    const parsedKey = parseObjectKey(source, i)
    if (parsedKey === undefined) {
      i += 1
      continue
    }

    i = parsedKey.next
    while (i < source.length && /\s/.test(source.charAt(i))) {
      i += 1
    }
    if (source.charAt(i) !== ":") {
      i += 1
      continue
    }
    i += 1
    while (i < source.length && /\s/.test(source.charAt(i))) {
      i += 1
    }
    if (source.charAt(i) !== "{") {
      i += 1
      continue
    }

    const valueStart = i
    const valueEnd = findMatchingBrace(source, valueStart)
    properties.push({
      key: parsedKey.key,
      value: source.slice(valueStart, valueEnd + 1),
    })
    i = valueEnd + 1
  }

  return properties
}

function parseFirstFallback(entry: string): SyncedAgentConfig | undefined {
  const fallbackIndex = entry.indexOf("fallbackChain")
  if (fallbackIndex < 0) {
    return undefined
  }

  const chainStart = entry.indexOf("[", fallbackIndex)
  if (chainStart < 0) {
    return undefined
  }

  const firstEntryStart = entry.indexOf("{", chainStart)
  if (firstEntryStart < 0) {
    return undefined
  }

  const firstEntryEnd = findMatchingBrace(entry, firstEntryStart)
  const firstEntry = entry.slice(firstEntryStart, firstEntryEnd + 1)

  const modelMatch = /model:\s*"([^"]+)"/.exec(firstEntry)
  const model = modelMatch?.[1]
  if (model === undefined) {
    return undefined
  }

  const variantMatch = /variant:\s*"([^"]+)"/.exec(firstEntry)
  const variant = variantMatch?.[1]
  if (variant === undefined) {
    return { model }
  }

  return { model, variant }
}

function isIdentifierKey(key: string): boolean {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key)
}

function formatMonthYear(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date)
}

export function parseUpstreamAgentRequirements(source: string): AgentDefaults {
  const categoryMarkerIndex = source.indexOf(CATEGORY_REQUIREMENTS_MARKER)
  if (categoryMarkerIndex < 0) {
    throw new Error(`Could not find marker: ${CATEGORY_REQUIREMENTS_MARKER}`)
  }

  const agentSlice = source.slice(0, categoryMarkerIndex)
  const agentObject = findTopLevelObjectByMarker(agentSlice, AGENT_REQUIREMENTS_MARKER)
  const properties = extractTopLevelProperties(agentObject)

  const parsed: AgentDefaults = {}
  for (const property of properties) {
    const firstFallback = parseFirstFallback(property.value)
    if (firstFallback !== undefined) {
      parsed[property.key] = firstFallback
    }
  }

  return parsed
}

export function buildExpectedAgentDefaults(
  current: AgentDefaults,
  upstream: AgentDefaults,
): AgentDefaults {
  const expected: AgentDefaults = {}

  for (const [agent, config] of Object.entries(current)) {
    const upstreamConfig = upstream[agent]
    if (upstreamConfig === undefined) {
      expected[agent] = { ...config }
      continue
    }

    const slashIndex = config.model.indexOf("/")
    const provider = slashIndex >= 0 ? config.model.slice(0, slashIndex) : ""
    const model = provider.length > 0 ? `${provider}/${upstreamConfig.model}` : upstreamConfig.model

    expected[agent] = upstreamConfig.variant
      ? { model, variant: upstreamConfig.variant }
      : { model }
  }

  return expected
}

export function diffAgentDefaults(
  current: AgentDefaults,
  expected: AgentDefaults,
): AgentDefaultDiff[] {
  const allKeys = new Set([...Object.keys(current), ...Object.keys(expected)])
  const diffs: AgentDefaultDiff[] = []

  for (const agent of Array.from(allKeys).sort()) {
    const currentConfig = current[agent]
    const expectedConfig = expected[agent]
    if (currentConfig === undefined || expectedConfig === undefined) {
      continue
    }

    const currentVariant = currentConfig.variant ?? undefined
    const expectedVariant = expectedConfig.variant ?? undefined
    if (currentConfig.model !== expectedConfig.model || currentVariant !== expectedVariant) {
      diffs.push({
        agent,
        current: currentConfig,
        expected: expectedConfig,
      })
    }
  }

  return diffs
}

export function applyAgentDefaultsToDefaultsFile(
  defaultsFileContent: string,
  expectedAgents: AgentDefaults,
  upstreamTag: string,
  now: Date,
): string {
  const entries = Object.entries(expectedAgents).map(([agent, config]) => {
    const key = isIdentifierKey(agent) ? agent : JSON.stringify(agent)
    if (config.variant === undefined) {
      return `    ${key}: { model: "${config.model}" },`
    }
    return `    ${key}: { model: "${config.model}", variant: "${config.variant}" },`
  })

  const agentsBlock = `  agents: {\n${entries.join("\n")}\n  },`

  const agentsStart = defaultsFileContent.indexOf("  agents:")
  if (agentsStart < 0) {
    throw new Error("Could not find agents block in defaults.ts")
  }

  const agentsOpenBrace = defaultsFileContent.indexOf("{", agentsStart)
  if (agentsOpenBrace < 0) {
    throw new Error("Could not find agents object start in defaults.ts")
  }

  const agentsCloseBrace = findMatchingBrace(defaultsFileContent, agentsOpenBrace)
  let agentsEnd = agentsCloseBrace + 1
  if (defaultsFileContent[agentsEnd] === ",") {
    agentsEnd += 1
  }

  let updated = `${defaultsFileContent.slice(0, agentsStart)}${agentsBlock}${defaultsFileContent.slice(
    agentsEnd,
  )}`

  updated = updated.replace(
    /\* https:\/\/github\.com\/code-yeongyu\/oh-my-opencode\/blob\/[^\s]+\/src\/shared\/model-requirements\.ts/,
    `* https://github.com/code-yeongyu/oh-my-opencode/blob/${upstreamTag}/src/shared/model-requirements.ts`,
  )

  updated = updated.replace(
    /\* Last Updated: .*$/m,
    `* Last Updated: ${formatMonthYear(now)} (${upstreamTag})`,
  )

  return updated
}
