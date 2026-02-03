# oh-my-opencode-config

Interactive CLI for managing model assignments in `oh-my-opencode.json`.

Easily configure which models and variants are used by different agents and categories in your OpenCode configuration.

## Features

- **Interactive TUI**: User-friendly prompts for agent and category configuration.
- **Model Validation**: Ensures selected models meet agent capability requirements (reasoning, tool calls, attachments).
- **Configuration Discovery**: Automatically finds project-level or user-level config files.
- **Atomic Writes**: Safe configuration updates with temporary files and renames.
- **Automatic Backups**: Keeps track of configuration changes with restore capabilities.
- **Diff View**: Preview changes before applying them.

## Installation

This CLI requires [Bun](https://bun.sh/) as its runtime.

```bash
# Install Bun first (if not already installed)
curl -fsSL https://bun.sh/install | bash

# Then install the CLI
npm install -g oh-my-opencode-config
```

## Quick Start

Show current model assignments:

```bash
oh-my-opencode-config list
```

## Commands

### `menu`
Interactive main menu with all options. Best starting point for beginners - navigate between all features without restarting the CLI.

### `status`
Shows configuration status with visual indicators:
- ✓ Green check: Agent properly configured with valid model
- ⚠ Yellow warning: Agent configured but model missing capabilities
- ✗ Red X: Agent not configured
- ? Unknown: Model not found in cache

### `list`
Displays the current configuration, showing which models and variants are assigned to agents and categories. Use `--json` for machine-readable output.

### `configure agents`
Interactive wizard to assign models to specific agents (e.g., oracle, librarian, sisyphus). It filters models based on the agent's requirements.

### `configure categories`
Interactive wizard to assign models to task categories (e.g., frontend-ui-ux, react-dev).

### `configure quick-setup`
Apply preset configurations to rapidly switch between profiles:
- **Standard (Recommended)**: Default high-performance models (e.g., GPT-5.2, Claude Opus 4.5)
- **Economy**: Cost-effective models (e.g., GPT-4o Mini, Gemini Flash, Claude Haiku)

### `reset`
Resets the configuration to default values. Requires confirmation.

### `backup list`
Lists all available configuration backups with their timestamps.

### `backup restore <timestamp>`
Restores the configuration from a specific backup.

### `profile save [name]`
Save current configuration as a named profile. If no name is provided, prompts interactively.

### `profile use [name]`
Switch to a previously saved profile. If no name is provided, shows an interactive selection.

### `profile list`
List all available saved profiles.

### `profile delete [name]`
Delete a saved profile. If no name is provided, prompts interactively.

### `profile rename [old] [new]`
Rename an existing profile.

### `diff`
Shows the difference between your current configuration and the default settings with color coding and summary statistics.

### `refresh`
Manually refresh the available models cache from `opencode models`.

### `clear-cache`
Clear the available models cache to force a fresh fetch on next run.

### `doctor`
Diagnose configuration issues and validate setup. Checks for:
- Missing or corrupted cache
- Invalid model assignments
- Capability mismatches
- Defunct agent configurations

Use `--fix` to automatically resolve cache issues when possible.

### `import [path]`
Import configuration from a JSON file. If no path is provided, prompts for file selection.

### `export [path]`
Export current configuration to a JSON file. If no path is provided, prompts for destination.

### `undo`
Undo the last configuration change by restoring the most recent backup.

### `history`
Show configuration change history from backups. Use `--limit <number>` to restrict the number of entries shown.

## Global Flags

- `--config <path>`: Override the default `oh-my-opencode.json` path (not `opencode.json`).
- `--opencode-config <path>`: Override the `opencode.json` path for loading custom models.
- `--refresh`: Force refresh of available models cache from `opencode models`.
- `--json`: Output results in JSON format (where applicable).
- `--verbose`: Enable detailed logging and stack traces on errors.
- `--dry-run`: Preview changes without writing to disk.

## Configuration Files

This tool manages **model assignments** in `oh-my-opencode.json`. It also reads model definitions from your main OpenCode config (`opencode.json`) to support custom models from plugins like antigravity.

### `oh-my-opencode.json` (Managed by this tool)
Contains agent/category to model mappings:
```json
{
  "agents": {
    "oracle": { "model": "google/antigravity-gemini-3-pro", "variant": "high" }
  }
}
```

**Discovery order:**
1. Path provided via `--config` flag
2. Project-level: `.opencode/oh-my-opencode.json` (searches up from current directory)
3. User-level: `~/.config/opencode/oh-my-opencode.json`

### `opencode.json` (Main OpenCode config)
Contains model definitions from plugins. This tool reads from `~/.config/opencode/opencode.json` to discover custom models like antigravity:
```json
{
  "plugin": ["opencode-antigravity-auth@latest"],
  "provider": {
    "google": {
      "models": {
        "antigravity-gemini-3-pro": { "name": "...", "variants": {...} }
      }
    }
  }
}
```

## Agent Requirements

The following requirements are enforced during model selection:

| Agent | Required Capabilities |
|-------|-----------------------|
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

### Custom Models Not Showing (e.g., Antigravity Plugin)
If models from plugins like `opencode-antigravity-auth` don't appear:

1. **Verify models are registered with opencode:**
   ```bash
   opencode models | grep antigravity
   ```
   If models appear here, this tool will find them in `~/.config/opencode/opencode.json`.

2. **Ensure plugin is configured in `opencode.json`:**
   ```json
   {
     "plugin": ["opencode-antigravity-auth@latest"],
     "provider": {
       "google": {
         "models": {
           "antigravity-gemini-3-pro": { ... }
         }
       }
     }
   }
   ```

3. **Refresh the models cache:**
   ```bash
   opencode models --refresh
   ```

### Cache Not Found
If the models cache is missing, the CLI will offer to refresh it using `opencode models --refresh`.

### Permission Denied
Ensure you have write access to the configuration directory. You may need to run with `sudo` if modifying global configurations.

### Concurrent Modification
If another process modifies the configuration while you are using the CLI, it will detect the conflict and abort to prevent data loss.

## Source of Defaults

The default model assignments in this tool are synchronized with the [oh-my-opencode](https://github.com/code-yeongyu/oh-my-opencode) repository.

**Source of Truth:**
- [`src/shared/model-requirements.ts`](https://github.com/code-yeongyu/oh-my-opencode/blob/main/src/shared/model-requirements.ts) — Defines fallback chains for both agents (`sisyphus`, `oracle`, etc.) and categories (`visual-engineering`, `ultrabrain`, etc.)

If the defaults in this CLI seem outdated, compare them against this file in the upstream repository.

## Contributing

This project uses a **develop/main branching workflow**:

- **`develop`** — Active development branch (default)
- **`main`** — Production releases only

### Workflow

```bash
# 1. Work on develop
git checkout develop
git pull origin develop

# 2. Make changes
# ... your changes ...
git commit -m "feat: add feature"
git push origin develop

# 3. When ready to release, create changeset
bunx changeset
git add .changeset && git commit -m "chore: add changeset"
git push origin develop

# 4. Create PR: develop → main
gh pr create --base main --head develop --title "Release"

# 5. Merge PR → auto-publishes to npm
```

**CI/CD:**
- **develop pushes** → Run tests (`.github/workflows/ci.yml`)
- **main merges** → Run tests + publish to npm (`.github/workflows/release.yml`)

## Development

```bash
# Install dependencies
bun install

# Run tests
bun test

# Run in development mode
bun run dev
```

## License

MIT
