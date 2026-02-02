# oh-my-opencode-config

Interactive CLI for managing model assignments in `oh-my-opencode.json`.

**Runtime**: Bun only. No npm/yarn/pnpm.

```bash
bun install        # deps
bun run build      # tsc → dist/
bun run dev        # hot reload
bun test           # bun:test
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
├── models/            # Parser for models cache + opencode.json custom models
├── validation/        # Model capability validation (type guards, not assertions)
├── prompts/           # @clack/prompts TUI components (agents, models, variants, provider)
├── profile/           # Named config profiles (save/load/switch/delete)
├── diff/              # Config diff generation + formatting
├── backup/            # Backup rotation (keep 10)
├── errors/            # Error classes + handlers
├── utils/             # Shared utilities (fs, output)
└── index.ts           # Entry (#!/usr/bin/env bun)
```

## Where to Look

| Task | Location |
|------|----------|
| Add CLI command | `src/cli/commands/` + register in `src/cli/index.ts` |
| New config field | `src/types/config.ts` (schema) + `src/config/defaults.ts` |
| Agent requirements | `src/types/requirements.ts` |
| Model validation | `src/validation/capabilities.ts` |
| Error handling | `src/errors/handlers.ts` |
| File paths | `src/config/paths.ts` |
| Default models | `src/config/defaults.ts` (synced from oh-my-opencode repo) |
| Profile management | `src/profile/manager.ts` |
| TUI prompts | `src/prompts/` (agents, models, variants, provider, main) |
| Config path resolution | `src/config/resolve.ts` (shared by all commands) |
| File utilities | `src/utils/fs.ts` (atomicWrite, isErrnoException, getFileMtime) |
| Terminal output | `src/utils/output.ts` (printLine, printTable, printBlank) |

## Key Files

- **Models cache**: `~/.cache/opencode/models.json`
- **User config**: `~/.config/opencode/oh-my-opencode.json`
- **Project config**: `.opencode/oh-my-opencode.json` (precedence)
- **OpenCode config**: `~/.config/opencode/opencode.json` (custom models from plugins)
- **Profiles dir**: sibling to config file (e.g. `~/.config/opencode/profiles/`)

## Most-Imported Modules (Centrality)

| Module | Importers | Role |
|--------|-----------|------|
| `utils/output` | 16 | ALL terminal output |
| `cli/types` | 14 | BaseCommandOptions for all commands |
| `config/resolve` | 13 | Config path resolution |
| `config/loader` | 10 | Load + validate config |
| `types/config` | 10 | Core Config type |
| `utils/fs` | 8 | File operations |

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

### File Operations

- **Atomic writes**: temp file + `fs.rename` [see: config/writer.ts, utils/fs.ts]
- Use `Bun.file()` / `Bun.write()` over node:fs

### Error Handling

- Custom errors in `src/errors/types.ts` (7 classes: CacheMissing, CacheCorrupted, PermissionDenied, ConcurrentModification, InvalidConfig, GracefulExit, CacheExpired)
- Centralized handling via `handleError(error, verbose)`
- User cancellation → `GracefulExitError` → exit 0
- **No stack traces to users** (only with `--verbose`)

### Testing

- Co-located: `*.test.ts` next to source
- `bun:test` framework
- Mock with `mock.module()`, spy with `spyOn`
- File tests: `fs.mkdtemp` + `os.tmpdir()` for isolation
- Shared mock setup: `src/cli/commands/test-mocks.ts`
- Mock helper: `src/test-utils/mocks.ts` (`asMock()`)
- **Baseline**: 224 pass, 7 fail (pre-existing cross-file mock pollution in handlers.test.ts)

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

- Uses `execa` instead of `Bun.$` for shell
- `.js` extensions in imports (NodeNext)
- `tsc` build instead of `bun build`

## Commands

| Command | Description |
|---------|-------------|
| `menu` | Interactive main menu (best entry point) |
| `list` | Show current config |
| `status` | Config health check with visual indicators |
| `configure agents` | Assign models to agents |
| `configure categories` | Assign models to categories |
| `quick-setup` | Apply preset profiles (Standard/Economy) |
| `profile` | Save/load/switch/delete named config profiles |
| `reset` | Reset to defaults |
| `diff` | Show changes from defaults |
| `doctor` | Diagnose + validate config (cache, capabilities, defunct agents) |
| `history` | View config change history |
| `undo` | Revert last config change |
| `backup list` | List backups |
| `backup restore <ts>` | Restore backup |
| `import` | Import config from file |
| `export` | Export config to file |
| `refresh` | Refresh models cache from `opencode models` |
| `clear-cache` | Clear models cache |

**Global flags**: `--json` `--config <path>` `--opencode-config <path>` `--refresh` `--verbose` `--dry-run`
