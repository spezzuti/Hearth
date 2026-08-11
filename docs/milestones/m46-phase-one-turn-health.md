# Milestone 46 — Workshop turn health and Provider Doctor

Hearth 0.49.0 replaces the managed Workshop's single absolute timeout with an evidence-backed
lifecycle model.

## Delivered

- renewable provider/tool idle deadline plus a separate two-hour safety ceiling
- persisted working, permission-wait, quiet, stalled, interrupted, failed, and completed health
- bounded failure class, plain-language fate, and mutation-aware retry guidance
- explicit fresh-session retirement with no automatic replay or deleted workstream history
- honest per-turn usage when the provider reports it or a transcript delta can be proved
- read-only Claude/Codex Provider Doctor with visible setup guidance
- restart cleanup that clears pending permissions and explains orphaned work
- dev-only `js-yaml` 4.3.1 audit repair; complete and production audits clean

## Local evidence

- `npm run typecheck`
- 106 unit tests across 15 files
- production renderer and desktop build
- all 13 serial Electron scenarios

## Release evidence

The required packaged Claude/Codex baseline, long healthy tool soak, adapter-failure drill, and
pending-permission shutdown drill were completed in 0.49.1. See
[Milestone 47](m47-phase-one-live-release-gate.md) for the resulting fixes and exact evidence.
