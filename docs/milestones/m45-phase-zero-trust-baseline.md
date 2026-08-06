# Milestone 45: Phase 0 trust baseline

Hearth 0.48.0 restores the release baseline before turn-health and Provider Doctor work begins.

## Delivered

- Zero known production or development dependency advisories after minimal transitive repairs.
- Isolated upgrades to Claude ACP 0.65.0, Codex ACP 1.1.10, `node-pty` 1.2.0-beta.15, and Electron
  43.3.0.
- A Windows GitHub Actions workflow for locked install, production audit, type checking, unit tests,
  production build, and the deterministic Electron suite.
- Provider model provenance across resident status and managed Maker session state.
- Configured Claude aliases no longer masquerade as reported live model identity.
- Managed Maker promotes the actual model reported by ACP configuration or the bounded Claude
  transcript.

## Evidence

- `npm audit` and `npm audit --omit=dev`: zero vulnerabilities.
- `npm run verify`: 106 unit tests across 15 files and all 13 serial Electron scenarios.
- Rebuilt unpacked Windows package: real ConPTY smoke passed.
- Optional live packaged smoke: Codex provider active, Claude provider active, six work activities,
  plan mode observed, detailed/output activity present, token usage reported, model reported as
  Claude Opus 5, and cancel-then-replace interruption completed cleanly.

## Remaining external confirmation

The workflow exists locally but cannot be called publicly green until these commits are pushed and
the hosted Windows runner completes successfully. A badge remains deliberately absent until then.
