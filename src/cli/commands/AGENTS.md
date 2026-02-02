# CLI Commands

Command implementations for oh-my-opencode-config.

## Structure

Each command exports an async function:
```typescript
export async function commandName(
  options: Pick<BaseCommandOptions, "config" | "json" | ...>,
): Promise<void>
```

Options use `Pick<BaseCommandOptions, ...>` — never the full interface.

## Command Categories

| Category | Commands |
|----------|----------|
| **Config Mgmt** | `list`, `reset`, `configure`, `import`, `export`, `profile` |
| **Inspection** | `status`, `doctor`, `diff`, `history` |
| **Maintenance** | `backup`, `undo`, `refresh`, `clear-cache` |
| **Interactive** | `menu`, `quick-setup` |

## Where to Look

| Task | File |
|------|------|
| Add new command | Create `{name}.ts`, export function, register in `../index.ts` |
| Command options | `Pick<BaseCommandOptions, ...>` from `../types.js` |
| Error handling | Wrap in try/catch, use `handleError(error, options.verbose)` |
| User prompts | `@clack/prompts`: `select`, `input`, `confirm`, `isCancel` |
| Config path | `resolveConfigPath(options.config)` from `../../config/resolve.js` |

## Shared Helpers in `configure.ts`

`configure.ts` has two private helpers used by both `configureAgentsCommand` and `configureCategoriesCommand`:

| Helper | Purpose |
|--------|---------|
| `loadConfigureContext(options, title)` | Validates cache, resolves config, loads models, shows intro + spinner |
| `saveConfigureResult(configPath, old, new, mtime, dryRun?)` | Generates diff, confirms with user, atomic save + backup |
| `configureAgentFlow(cache, agent, model?, variant?)` | Multi-step provider→model→variant selection with back navigation |

## Shared Helpers in `history.ts`

| Helper | Purpose |
|--------|---------|
| `buildHistoryEntries(backups)` | Processes backups into diff entries with add/modify/remove counts |
| `formatChangeValue(value)` | Safely extracts model string from `DiffEntry.old`/`.new` |

## Standard Command Template

```typescript
import { resolveConfigPath } from "../../config/resolve.js"
import type { BaseCommandOptions } from "../types.js"

export async function myCommand(
  options: Pick<BaseCommandOptions, "config" | "verbose">,
): Promise<void> {
  const configPath = resolveConfigPath(options.config)
  // ... implementation
}
```

## Testing

Co-located tests: `{name}.test.ts`
- Shared mock setup: `test-mocks.ts` (central mock registry for all command tests)
- Use `fs.mkdtemp` + `os.tmpdir()` for file isolation
- Mock `@clack/prompts` with `mock.module()`
- Test error paths, not just success

## Anti-Patterns

| Forbidden | Why |
|-----------|-----|
| `console.log` for user output | Use `@clack/prompts` for TUI |
| Raw error throwing | Use `handleError()` for consistent UX |
| Skip `isCancel` checks | Users must be able to cancel cleanly |
| `process.exit()` | Let errors bubble to handler |
| Inline config resolution | Use `resolveConfigPath()` |
| `(error as Error).message` | Use `isErrnoException()` or custom error classes |
