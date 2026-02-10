# oh-my-opencode-config

Interactive CLI to manage model assignments in `oh-my-opencode.json` for OpenCode.

Use it to pick models and variants per agent and category, validate capabilities, and keep configs safe with backups.

## Install

Requires Bun.

```bash
curl -fsSL https://bun.sh/install | bash
bun add -g oh-my-opencode-config
```

## Quick start

```bash
oh-my-opencode-config
```

```bash
oh-my-opencode-config list
```

Run `oh-my-opencode-config --help` for the full command list.

## Commands

| Command | What it does |
| --- | --- |
| `menu` | Open the interactive menu |
| `list` | Show current config |
| `status` | Check config health |
| `configure agents` | Assign models to agents |
| `configure categories` | Assign models to categories |
| `configure quick-setup` | Apply Standard or Economy presets |
| `reset` | Reset to default model assignments |
| `diff` | Show changes from defaults |
| `doctor` | Diagnose issues (`--fix` repairs cache) |
| `backup list` | List backups |
| `backup restore <timestamp>` | Restore a backup |
| `profile save/use/list/delete/rename/template` | Manage profiles |
| `import [path]` | Import config JSON |
| `export [path]` | Export config JSON |
| `refresh` | Refresh models cache |
| `clear-cache` | Clear models cache |
| `undo` | Restore most recent backup |
| `history` | Show change history |

## Global flags

- `--config <path>` Override the `oh-my-opencode.json` path.
- `--opencode-config <path>` Override the `opencode.json` path for custom models.
- `--refresh` Force refresh of the models cache.
- `--json` Output as JSON (where supported).
- `--verbose` Include detailed logs and stack traces.
- `--dry-run` Preview changes without writing.
- `--template <path>` Override the profile template path used by `profile save`.
- `--no-update-notifier` Disable automatic CLI update checks at startup.

## Configuration files

This tool writes `oh-my-opencode.json` and reads `opencode.json` for custom models.

Discovery order:
1. `--config`
2. `./.opencode/oh-my-opencode.json` (current directory)
3. `~/.config/opencode/oh-my-opencode.json`

Models cache: `~/.cache/opencode/models.json`

### `oh-my-opencode.json`

```json
{
  "agents": {
    "oracle": { "model": "google/antigravity-gemini-3-pro", "variant": "high" }
  }
}
```

### `oh-my-opencode.template.json`

Used as a base when saving profiles. Create it with `profile template` or provide one via `--template <path>`.

Example template:
```json
{
  "$schema": "https://raw.githubusercontent.com/code-yeongyu/oh-my-opencode/master/assets/oh-my-opencode.schema.json",
  "google_auth": false,
  "sisyphus_agent": {
    "default_builder_enabled": true,
    "replace_plan": true
  },
  "git_master": {
    "commit_footer": false,
    "include_co_authored_by": false
  },
  "disabled_hooks": ["comment-checker"]
}
```

### `opencode.json`

This is OpenCode’s main config. This CLI does not write it. It reads model definitions here so custom/plugin models show up in the picker. Use `--opencode-config` if your file lives elsewhere.

Minimal example:

```json
{
  "plugin": ["opencode-antigravity-auth@latest"],
  "provider": {
    "google": {
      "models": {
        "antigravity-gemini-3-pro": {
          "name": "Antigravity Gemini 3 Pro",
          "variants": { "high": {}, "low": {} }
        }
      }
    }
  }
}
```

## Agent requirements

| Agent | Required capabilities |
| --- | --- |
| oracle | reasoning, tool_call |
| librarian | tool_call |
| explore | tool_call |
| multimodal-looker | attachment |
| prometheus | reasoning, tool_call |
| metis | reasoning |
| sisyphus | reasoning, tool_call |
| atlas | reasoning, tool_call |
| hephaestus | reasoning, tool_call |
| momus | reasoning |

## Troubleshooting

### Custom models not showing

1. Check that `opencode` sees the model:
   ```bash
   opencode models | grep antigravity
   ```
2. Confirm the plugin and model are in `opencode.json`.
3. Refresh the cache:
   ```bash
   opencode models --refresh
   ```

### Cache missing

Run `oh-my-opencode-config refresh`, or let `doctor` offer a refresh.

### Permission denied

Ensure you can write to the config directory.

### Concurrent modification

If another process writes the config, the CLI aborts to avoid data loss.

## Defaults source

Defaults are synced from the upstream `oh-my-opencode` repository. See `src/shared/model-requirements.ts` in that repo for the current fallback chains.

## Contributing

We use a `develop` → `main` flow.

1. Work on `develop`.
2. Create a changeset before release.
3. Open a PR from `develop` to `main`.

## Development

```bash
bun install
bun run dev
bun run test
bun run check
bun run typecheck
```

## License

MIT
