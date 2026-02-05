# Changelog

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
