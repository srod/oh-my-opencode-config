---
"oh-my-opencode-config": patch
---

Sync defaults with upstream `oh-my-opencode` `v3.8.0` and improve defaults sync tooling:

- Update agent defaults and metadata to `v3.8.0`
- Update category defaults (`unspecified-low` and `writing`) to match upstream
- Extend sync script behavior to validate/apply both agent and category defaults
- Add `sync:defaults:check` and `sync:defaults:apply` script names, keeping `sync:agents:*` as backward-compatible aliases
