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

/**
 * Finds the index of the closing brace that matches an opening brace in a source string.
 *
 * @param source - The source text to scan.
 * @param openIndex - The index of the opening `{` to match.
 * @returns The index of the matching closing `}` character.
 * @throws Error if no matching closing brace is found for the opening brace at `openIndex`.
 */
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

  throw new Error(`Failed to match closing brace for object starting at index ${openIndex}`)
}

/**
 * Extracts the contents of the top-level object that immediately follows a marker string.
 *
 * @param source - The source text to search.
 * @param marker - The marker text that precedes the target object.
 * @returns The substring between the object's opening `{` and its matching closing `}`.
 * @throws If the `marker` is not found, if an opening `{` cannot be found after the marker, or if a matching closing brace cannot be located.
 */
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

/**
 * Parses a JavaScript-like object key starting at the given index.
 *
 * Supports quoted keys (single or double quotes) with backslash escapes and unquoted identifier-style keys
 * that start with a letter, `_`, or `$` and may contain letters, digits, `_`, `$`, or `-`.
 *
 * @param source - Source string containing the object text
 * @param startIndex - Index in `source` where the key is expected to start
 * @returns An object with `key` (the parsed key string) and `next` (index immediately after the key) or `undefined` if no valid key is found
 */
function parseObjectKey(
  source: string,
  startIndex: number,
): { key: string; next: number } | undefined {
  const firstChar = source.charAt(startIndex)
  if (firstChar === '"' || firstChar === "'") {
    const quoteChar = firstChar
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
      if (char === quoteChar) {
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

/**
 * Extracts top-level object properties from a JavaScript-like object text.
 *
 * Scans `source` for top-level keys followed by object literal values, skipping whitespace,
 * commas, and single-line comments. For each found property the `key` is the parsed property
 * name and the `value` is the substring containing the object's literal value including
 * its surrounding braces.
 *
 * @param source - Text containing object properties to scan (typically the contents between an object's braces)
 * @returns An array of `{ key, value }` entries where `key` is the property name and `value` is the object's value text (including `{` and `}`)
 */
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

/**
 * Extracts the first fallback's model and optional variant from a `fallbackChain` entry string.
 *
 * @param entry - Source string containing a `fallbackChain` array entry to parse
 * @returns `SyncedAgentConfig` for the first object in `fallbackChain`, or `undefined` if no valid first fallback is found
 */
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

/**
 * Determines whether a string is a valid JavaScript identifier name.
 *
 * @param key - The string to test as an identifier
 * @returns `true` if `key` starts with a letter, underscore, or dollar sign and contains only letters, digits, underscores, or dollar signs; `false` otherwise.
 */
function isIdentifierKey(key: string): boolean {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key)
}

/**
 * Format a date as a short month and numeric year in the en-US locale.
 *
 * @param date - The date to format
 * @returns The formatted string (for example, "Feb 2026")
 */
function formatMonthYear(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date)
}

/**
 * Parse upstream agent requirement definitions from a source string into agent default configurations.
 *
 * @param source - The complete upstream source text that contains agent and category model requirement blocks.
 * @returns An AgentDefaults mapping each agent key to the first `SyncedAgentConfig` found in its fallback chain.
 * @throws If the category or agent requirements marker cannot be located in the provided source.
 */
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

/**
 * Builds the expected agent defaults by aligning each current agent with upstream model requirements.
 *
 * For each agent in `current`, if `upstream` provides a config the result uses the upstream model and variant;
 * if the current agent's model includes a provider prefix (text before `/`), that prefix is preserved and applied
 * to the upstream model name. Agents absent from `upstream` are copied from `current`.
 *
 * @param current - Mapping of agent keys to their existing synced configurations
 * @param upstream - Mapping of agent keys to upstream synced configurations to adopt
 * @returns A mapping of agent keys to the computed expected synced configurations
 */
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
    const upstreamSlashIndex = upstreamConfig.model.indexOf("/")
    const upstreamModelName =
      upstreamSlashIndex >= 0
        ? upstreamConfig.model.slice(upstreamSlashIndex + 1)
        : upstreamConfig.model
    const model = provider.length > 0 ? `${provider}/${upstreamModelName}` : upstreamConfig.model

    expected[agent] = upstreamConfig.variant
      ? { model, variant: upstreamConfig.variant }
      : { model }
  }

  return expected
}

/**
 * Produce a list of agent default differences between two sets of agent defaults.
 *
 * @param current - The current agent defaults to compare
 * @param expected - The expected/upstream agent defaults to compare against
 * @returns An array of diffs for agents present in both inputs where the `model` or `variant` differ; each diff contains the agent key, the current config, and the expected config
 */
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

/**
 * Replace the agents block and version metadata in a defaults file with the provided expected agents and upstream tag.
 *
 * @param defaultsFileContent - The original defaults file content to modify.
 * @param expectedAgents - Mapping of agent keys to desired model and optional variant to write into the agents block.
 * @param upstreamTag - Git tag or commit used to update the model-requirements URL and included in the Last Updated metadata.
 * @param now - Date used to format the Last Updated metadata.
 * @returns The updated defaults file content with the agents block, model-requirements URL, and Last Updated line replaced.
 * @throws Error if the agents block or its opening brace cannot be found in the provided defaults file content.
 */
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