# Changelog

## 0.4.1

### Patch Changes

- [#21](https://github.com/srod/oh-my-opencode-config/pull/21) [`0bd6d23`](https://github.com/srod/oh-my-opencode-config/commit/0bd6d23797da4925b2fb5349ee0e6a64e628cdb4) Thanks [@srod](https://github.com/srod)! - Sync defaults with upstream `oh-my-opencode` v3.7.1 metadata and category assignments:

  - `visual-engineering`: add variant `"high"` (previously no variant)
  - `writing`: change default model from `google/gemini-3-flash` to `kimi-for-coding/k2p5`

## 0.4.0

### Minor Changes

- [#15](https://github.com/srod/oh-my-opencode-config/pull/15) [`91e4f20`](https://github.com/srod/oh-my-opencode-config/commit/91e4f200c5b7f179fc27e21bc969409307be8f27) Thanks [@srod](https://github.com/srod)! - Add a cached CLI update notifier with startup banner, opt-out controls, and background refresh behavior for version checks.

## 0.3.2

### Patch Changes

- [#11](https://github.com/srod/oh-my-opencode-config/pull/11) [`80e2a5b`](https://github.com/srod/oh-my-opencode-config/commit/80e2a5bc0911149300563a6f3cc01f30ed8e539f) Thanks [@srod](https://github.com/srod)! - Fix config writes when using profile symlinks so edits update the active profile target instead of replacing `oh-my-opencode.json`.
  Also improve upstream sync parsing by handling single-quoted keys and adding clearer parse errors, and support authenticated GitHub API requests via `GITHUB_TOKEN`.

- [#11](https://github.com/srod/oh-my-opencode-config/pull/11) [`79f78e1`](https://github.com/srod/oh-my-opencode-config/commit/79f78e1cb9d8e42b7da355ead86091e41e3d7a27) Thanks [@srod](https://github.com/srod)! - Sync default agent and category model assignments to upstream oh-my-opencode v3.4.0.

## 0.3.1

### Patch Changes

- [#9](https://github.com/srod/oh-my-opencode-config/pull/9) [`46ea1d3`](https://github.com/srod/oh-my-opencode-config/commit/46ea1d34be44cc87dacde138b1b4c723a0927793) Thanks [@srod](https://github.com/srod)! - chore: trigger release

## 0.3.0

### Minor Changes

- [#2](https://github.com/srod/oh-my-opencode-config/pull/2) [`10c4c6c`](https://github.com/srod/oh-my-opencode-config/commit/10c4c6cf6784f8e0ef10ed9508b7b52efe907b70) Thanks [@srod](https://github.com/srod)! - Add profile template support, preserve unknown config keys, and introduce a profile template command with CLI/menu integration.

### Patch Changes

- [#5](https://github.com/srod/oh-my-opencode-config/pull/5) [`82aff32`](https://github.com/srod/oh-my-opencode-config/commit/82aff3270791c953e1943532eabbcd26bbaf6aab) Thanks [@srod](https://github.com/srod)! - Doctor now reports npm update availability for opencode and oh-my-opencode.

## [0.2.0] - 2026-02-04

### Minor Changes

- Add profile template support with `profile template` and `--template` override.
- Merge template defaults on profile save and preserve unknown config keys.

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-01-31

### Added

- Initial release of `oh-my-opencode-config` CLI.
- Interactive TUI for agent and category model assignment using `@clack/prompts`.
- Configuration discovery (project-level and user-level).
- Model validation based on agent capability requirements.
- Atomic configuration writes to prevent data corruption.
- Configuration backup and restore system (keeps last 10 backups).
- Diff view to compare current config with defaults.
- Comprehensive error handling for cache issues, permissions, and concurrent modifications.
- JSON output support for `list` command.
- Extensive test suite with >90% coverage for core modules.
