---
"oh-my-opencode-config": patch
---

Extend `doctor` npm checks to include `oh-my-opencode-config` itself:

- Add current CLI version in doctor report (`versions.ohMyOpencodeConfig`)
- Add npm update status for `oh-my-opencode-config` (`updates.ohMyOpencodeConfig`)
- Show a dedicated text output line for this CLI in `doctor`
