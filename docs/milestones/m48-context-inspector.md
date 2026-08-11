# Milestone 48 — Honest context inspector

Hearth 0.50.0 makes the Workshop context meter explainable without pretending Hearth can see inside
Claude's private prompt construction.

## Delivered

- persisted per-turn context manifest through schema migration 29
- exact assembled prompt characters separated from provider-reported token and window values
- contribution accounting for Hearth framing, current direction, recent conversation, explicit
  project evidence, terminal view, execution report, and approved House Memory
- visible truncation boundaries and fresh-versus-resumed session truth
- a bounded recent user-direction tail marked as sent this turn or local record only
- a contained, keyboard-accessible Workshop inspector with compact-layout protection
- keep working, Return Pack, and start-fresh choices only at 70% or more of a reported window
- explicit refusal to claim hidden provider prompts, compaction, or private buffers

## Evidence

- type checking
- 110 unit tests across 15 files
- all 13 serial Electron scenarios
- rebuilt 0.50.0 packaged baseline with Codex Critic, Claude Opus 5 Maker, detailed workstream,
  usage, plan mode, and interrupt-and-replace
- prompt-accounting tests prove contribution characters sum to the exact managed prompt length
- store coverage proves the manifest survives close and reopen
- the Workshop Electron scenario opens, dismisses, and contains the inspector at 1100 × 720
