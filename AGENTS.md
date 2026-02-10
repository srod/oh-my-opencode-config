# oh-my-opencode-config

Interactive CLI for managing model assignments in `oh-my-opencode.json`.

**Runtime**: Bun only. No npm/yarn/pnpm.

```bash
bun install        # deps
bun run build      # tsc → dist/
bun run dev        # hot reload (--conditions=source)
bun test           # bun:test (--conditions=source)
bun run check      # biome lint+format
bun run typecheck  # tsc --noEmit
```

## Structure

```
src/
├── cli/
│   ├── index.ts       # Commander setup, all command registration
│   ├── types.ts       # BaseCommandOptions (imported by ALL commands)
│   └── commands/      # Command implementations [see: cli/commands/AGENTS.md]
├── config/            # Config handling [see: config/AGENTS.md]
├── types/             # Zod schemas (Config, Model, Requirements, Colors)
├── models/            # Models cache parser + opencode.json custom model loader
├── validation/        # Model capability validation (type guards, not assertions)
├── prompts/           # @clack/prompts TUI (agents, models, variants, provider, searchable select)
├── profile/           # Named config profiles via symlinks (save/load/switch/delete/rename)
├── diff/              # Config diff generation + chalk formatting
├── backup/            # Backup rotation (keep 10) + restore
├── errors/            # Error classes (7) + centralized handler
├── update/            # CLI update notifier (npm registry check, 24h cache)
├── utils/             # Shared utilities (fs, output, npm, merge, execa, bun-file)
├── scripts/           # sync-agent-defaults (fetch upstream model-requirements.ts)
├── test-utils/        # Shared test helpers (asMock, clack mocks)
└── index.ts           # Entry (#!/usr/bin/env bun)
```

## Where to Look

| Task | Location |
|------|----------|
| Add CLI command | `src/cli/commands/` + register in `src/cli/index.ts` |
| New config field | `src/types/config.ts` (schema) + `src/config/defaults.ts` |
| Agent requirements | `src/types/requirements.ts` (`AGENT_REQUIREMENTS`) |
| Model validation | `src/validation/capabilities.ts` |
| Error handling | `src/errors/handlers.ts` (handler) + `src/errors/types.ts` (classes) |
| File paths / constants | `src/config/paths.ts` |
| Default models | `src/config/defaults.ts` (synced from oh-my-opencode repo) |
| Upstream sync | `src/config/upstream-agent-sync.ts` (parser) + `src/scripts/sync-agent-defaults.ts` |
| Profile management | `src/profile/manager.ts` (CRUD) + `src/profile/constants.ts` (validation) |
| TUI prompts | `src/prompts/` (agents, models, variants, provider, search) |
| Searchable select | `src/prompts/search.ts` (generic filterable list component) |
| Config path resolution | `src/config/resolve.ts` (shared by all commands) |
| File utilities | `src/utils/fs.ts` (atomicWrite, isErrnoException, getFileMtime) |
| Terminal output | `src/utils/output.ts` (printLine, printTable, printBlank) |
| Deep merge | `src/utils/merge.ts` (prototype-pollution-safe) |
| Update notifier | `src/update/notifier.ts` (background npm check, 24h cache) |
| Agent brand colors | `src/types/colors.ts` (hex map + colorizeAgent) |

## Key Files

- **Models cache**: `~/.cache/opencode/models.json` (read-only, from `opencode models`)
- **Available models cache**: `~/.cache/oh-my-opencode-config/available-models.json` (1h TTL)
- **User config**: `~/.config/opencode/oh-my-opencode.json`
- **Project config**: `.opencode/oh-my-opencode.json` (precedence)
- **OpenCode config**: `~/.config/opencode/opencode.json` (custom models from plugins)
- **Profiles**: sibling to config (e.g. `oh-my-opencode-{name}.json`, symlinked)
- **Profile template**: `oh-my-opencode.template.json` (merged into profiles on save)

## Most-Imported Modules (Centrality)

| Module | Importers | Role |
|--------|-----------|------|
| `utils/output` | 16 | ALL terminal output |
| `cli/types` | 14 | BaseCommandOptions for all commands |
| `config/resolve` | 13 | Config path resolution |
| `config/loader` | 10 | Load + validate config |
| `types/config` | 10 | Core Config type |
| `utils/fs` | 8 | File operations (atomicWrite, isErrnoException) |
| `errors/types` | 7 | Custom error classes |
| `types/requirements` | 7 | AGENT_REQUIREMENTS, Capability enum |

## Conventions

### Type Safety (STRICT)

- **No `any`** — enforced by biome + tsconfig
- **No `!`** (non-null assertion) — enforced
- **No `as Type`** — use type guards (`isAgentName`, `isCapability`, `hasProperty`, `isErrnoException`)
- **Zod schemas** for all external data (never raw `JSON.parse`)
- `noUncheckedIndexedAccess: true`
- `as const satisfies` for readonly constant records

### Shared Utilities (USE THESE, don't inline)

| Utility | Location | Replaces |
|---------|----------|----------|
| `resolveConfigPath(options.config)` | `config/resolve.ts` | `options.config \|\| discoverConfigPath() \|\| USER_CONFIG_FULL_PATH` |
| `isErrnoException(error)` | `utils/fs.ts` | `error instanceof Error && "code" in error` |
| `getFileMtime(path)` | `utils/fs.ts` | `fs.stat().catch() + stats?.mtime.getTime()` |
| `atomicWrite(path, content)` | `utils/fs.ts` | Direct `fs.writeFile` / `Bun.write` |
| `deepMerge(base, override)` | `utils/merge.ts` | Manual recursive merge (blocks `__proto__`) |

### File Operations

- **Atomic writes**: temp file + `fs.rename` [see: config/writer.ts, utils/fs.ts]
- Symlink resolution in atomicWrite (up to 40 levels, loop detection)
- Use `Bun.file()` / `Bun.write()` over node:fs

### Error Handling

- Custom errors in `src/errors/types.ts` (7 classes: CacheMissing, CacheCorrupted, PermissionDenied, ConcurrentModification, InvalidConfig, GracefulExit, CacheExpired)
- Profile errors in `src/profile/manager.ts` (6 classes: ProfileName, ProfileActive, ProfileNotFound, ProfileExists, DanglingSymlink + base ProfileError)
- Centralized handling via `handleError(error, verbose)`
- User cancellation → `GracefulExitError` → exit 0
- **No stack traces to users** (only with `--verbose`)

### Profile Architecture

- Profiles stored as `oh-my-opencode-{name}.json` files
- Active profile = symlink from `oh-my-opencode.json` → profile file
- Atomic symlink swap via temp symlink + rename
- Template merge on save (`oh-my-opencode.template.json` + `deepMerge`)
- Auto-creates "default" profile on first save

### Testing

- Co-located: `*.test.ts` next to source
- `bun:test` framework
- Mock with `mock.module()`, spy with `spyOn`
- File tests: `fs.mkdtemp` + `os.tmpdir()` for isolation
- Shared mock setup: `src/cli/commands/test-mocks.ts` (central mock registry, 178 lines)
- Clack mocks: `src/test-utils/clack-mocks.ts` (pre-built prompt mocks)
- Mock helper: `src/test-utils/mocks.ts` (`asMock()` for type-safe mock casting)
- **Baseline**: 273 pass, 0 fail across 23 files

## Anti-Patterns

| Forbidden | Why |
|-----------|-----|
| `any`, `!`, `as Type` | Type safety |
| Direct file writes | Use atomic temp+rename via `atomicWrite()` |
| Raw JSON.parse | Use Zod schemas |
| npm/yarn/pnpm/node | Bun only |
| Stack traces to users | Clean TUI |
| `console.log` for output | Use `@clack/prompts` / `printLine()` |
| Inline config resolution | Use `resolveConfigPath()` |
| Inline errno checks | Use `isErrnoException()` |

## Known Deviations

- Uses `execa` instead of `Bun.$` for shell (except `models/parser.ts` which uses `Bun.$`)
- `.js` extensions in imports (NodeNext)
- `tsc` build instead of `bun build`
- Path aliases: `#backup/*`, `#cli/*`, `#config/*`, `#diff/*`, `#errors/*`, `#models/*`, `#profile/*`, `#prompts/*`, `#types/*`, `#update/*`, `#utils/*`, `#validation/*`

## Commands

| Command | Description |
|---------|-------------|
| `menu` | Interactive main menu (best entry point) |
| `list` | Show current config |
| `status` | Config health check with visual indicators |
| `configure agents` | Assign models to agents |
| `configure categories` | Assign models to categories |
| `quick-setup` | Apply preset profiles (Standard/Economy) |
| `profile` | Save/load/switch/delete/rename named config profiles + template |
| `reset` | Reset to defaults |
| `diff` | Show changes from defaults |
| `doctor` | Diagnose + validate config (cache, capabilities, defunct agents). `--fix` flag |
| `history` | View config change history |
| `undo` | Revert last config change |
| `backup list` | List backups |
| `backup restore <ts>` | Restore backup |
| `import` | Import config from file |
| `export` | Export config to file |
| `refresh` | Refresh models cache from `opencode models` |
| `clear-cache` | Clear models cache |

**Global flags**: `--json` `--config <path>` `--opencode-config <path>` `--refresh` `--verbose` `--dry-run` `--template <path>` `--no-update-notifier`
