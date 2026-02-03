# Config Management

Core configuration handling: discovery, loading, resolution, writing.

## Files

| File | Purpose |
|------|---------|
| `resolve.ts` | `resolveConfigPath(option?)` — single entry point for config path resolution. Uses `\|\|` semantics (empty strings fall through). **All commands use this.** |
| `discover.ts` | Find config: project `.opencode/` → git root → `~/.config/opencode/`. Called by `resolve.ts`. |
| `loader.ts` | Read + Zod validate → typed `Config`. Returns `DEFAULT_CONFIG` if file missing. |
| `writer.ts` | Atomic writes (temp + rename), concurrent modification detection via mtime |
| `defaults.ts` | Default model assignments (synced from oh-my-opencode repo) |
| `paths.ts` | Path constants (`USER_CONFIG_FULL_PATH`, `PROJECT_CONFIG_REL_PATH`, `MODELS_CACHE_PATH`) |

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
3. Git root `.opencode/oh-my-opencode.json` (searches up)
4. `~/.config/opencode/oh-my-opencode.json` (user-level)

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

## Anti-Patterns

| Forbidden | Why |
|-----------|-----|
| Direct `fs.writeFile` / `Bun.write` for config | Corruption risk, no atomicity |
| `JSON.parse` without Zod | Type safety violation |
| Inline config resolution | Use `resolveConfigPath()` |
