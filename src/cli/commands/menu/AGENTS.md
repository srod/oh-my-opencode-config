# Interactive Menu Module

Orchestrator for TUI-based configuration via `@clack/prompts`.

## Structure

```
menu/
├── index.ts      # Main loop + action dispatch (21 actions)
├── configure.ts  # Multi-step wizard (PROVIDER→MODEL→VARIANT)
├── history.ts    # Backup diff analysis + undo
├── profile.ts    # Profile CRUD
├── io.ts         # Import/export with Zod validation
├── status.ts     # Diagnostic display
├── misc.ts       # Refresh, reset, backup restore, help
└── utils.ts      # Shared validation helpers
```

## Patterns

### State Machine (configure.ts)

```typescript
let step: "PROVIDER" | "MODEL" | "VARIANT" = "PROVIDER"
while (true) {
  if (step === "PROVIDER") { /* ... set step = "MODEL" */ }
  else if (step === "MODEL") { /* ... set step = "VARIANT" */ }
  else if (step === "VARIANT") { /* ... save & break */ }
}
```

- `BACK_ACTION` → step backwards
- `DONE_ACTION` → exit outer loop
- `isCancel(result)` → early return with yellow message

### Diff-Driven Workflow

All mutations follow:
```
generateDiff(old, new) → formatDiff() → confirm() → createBackup() → saveConfig()
```

### Cancellation

Every prompt checks `isCancel()`:
```typescript
if (isCancel(result) || typeof result === "symbol") {
  printLine(chalk.yellow("Cancelled."))
  return
}
```

## Where to Look

| Task | File |
|------|------|
| Add menu action | `index.ts` (options array + switch case) |
| Multi-step wizard | `configure.ts` (copy pattern) |
| Profile operations | `profile.ts` |
| Backup/history | `history.ts`, `misc.ts` |

## Anti-Patterns

| Forbidden | Why |
|-----------|-----|
| Skip `isCancel` checks | Users must cancel cleanly |
| Direct `console.log` | Use `printLine()` from utils/output |
| Skip diff preview | User must see changes before commit |

## Notes

- **No tests yet** — co-located `*.test.ts` files should be added
- `configure.ts` has 90% duplication between agents/categories (intentional — different iteration patterns)
- Main loop catches errors, prints red, continues (no crash)
