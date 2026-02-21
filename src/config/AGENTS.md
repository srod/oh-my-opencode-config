# Config Management

Core configuration handling: discovery, loading, resolution, writing, upstream sync.

## Files

| File | Lines | Purpose |
|------|-------|---------|
| `resolve.ts` | 17 | `resolveConfigPath(option?)` — single entry point for config path resolution. Uses `\|\|` semantics (empty strings fall through). **All commands use this.** |
| `discover.ts` | 37 | Find config: project `.opencode/` → `~/.config/opencode/`. Called by `resolve.ts`. |
| `loader.ts` | 38 | Read + Zod validate → typed `Config`. Returns `DEFAULT_CONFIG` if file missing. |
| `writer.ts` | 34 | Atomic writes (temp + rename), concurrent modification detection via mtime |
| `defaults.ts` | 35 | Default model assignments (synced from oh-my-opencode repo via upstream-agent-sync) |
| `paths.ts` | 37 | Path constants (`USER_CONFIG_FULL_PATH`, `PROJECT_CONFIG_REL_PATH`, `MODELS_CACHE_PATH`, `AVAILABLE_MODELS_CACHE_*`, `UPDATE_NOTIFIER_CACHE_*`) |
| `upstream-agent-sync.ts` | 434 | **Complex**: Parses upstream TypeScript source to extract agent/category model requirements. Hand-rolled parser (brace matching, string escaping, JS object key parsing). Used by sync script. |

## Config Path Resolution

```typescript
// CORRECT — use this everywhere
import { resolveConfigPath } from "#config/resolve.js"
const configPath = resolveConfigPath(options.config)

// WRONG — never inline this pattern
const configPath = options.config || discoverConfigPath() || USER_CONFIG_FULL_PATH
```

### Discovery Precedence

1. `--config <path>` flag (explicit)
2. `./.opencode/oh-my-opencode.json` (project-level)
3. `~/.config/opencode/oh-my-opencode.json` (user-level)

## Atomic Write (CRITICAL)

All config writes MUST go through `writer.ts` → `atomicWrite()`:

```typescript
const tmpPath = `${filePath}.tmp`
await Bun.write(tmpPath, content)
await fs.rename(tmpPath, filePath)
```

**Why**: Prevents corruption if process crashes mid-write.

### Concurrent Modification Detection

`saveConfig()` accepts `expectedMtime`. If file was modified since read, throws `ConcurrentModificationError`.

## Testing

- Use temp directories: `fs.mkdtemp(os.tmpdir())`
- Test concurrent modification detection
- Test atomic write integrity
- `resolve.test.ts`: 6 tests for path resolution logic

## Upstream Sync (`upstream-agent-sync.ts`)

Parses the oh-my-opencode repo's `model-requirements.ts` to extract default model assignments. Uses a hand-rolled JS object parser (NOT eval/Function):

| Function | Purpose |
|----------|---------|
| `parseUpstreamAgentRequirements(source)` | Extract agent→model map from upstream TS source |
| `parseUpstreamCategoryRequirements(source)` | Extract category→model map from upstream TS source |
| `buildExpectedAgentDefaults(current, upstream)` | Merge upstream agent models with current provider prefixes |
| `buildExpectedCategoryDefaults(current, upstream)` | Merge upstream category models with current provider prefixes |
| `diffAgentDefaults(current, expected)` | Compare current vs expected agent defaults, return diffs |
| `diffCategoryDefaults(current, expected)` | Compare current vs expected category defaults, return diffs |
| `applyAgentDefaultsToDefaultsFile(content, agents, tag, date, categories?)` | Rewrite `defaults.ts` blocks + sync metadata |

Invoked via `src/scripts/sync-agent-defaults.ts` (CLI script).

## Anti-Patterns

| Forbidden | Why |
|-----------|-----|
| Direct `fs.writeFile` / `Bun.write` for config | Corruption risk, no atomicity |
| `JSON.parse` without Zod | Type safety violation |
| Inline config resolution | Use `resolveConfigPath()` |
