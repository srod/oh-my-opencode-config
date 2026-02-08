---
"oh-my-opencode-config": patch
---

Fix config writes when using profile symlinks so edits update the active profile target instead of replacing `oh-my-opencode.json`.
Also improve upstream sync parsing by handling single-quoted keys and adding clearer parse errors, and support authenticated GitHub API requests via `GITHUB_TOKEN`.
