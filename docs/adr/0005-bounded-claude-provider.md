# ADR 0005: Bounded Claude Code reasoning beside the Workshop

## Status

Accepted for Hearth 0.5.

## Context

Hearth has two different Claude-shaped needs:

1. the user's persistent, interactive Claude Code process in Workshop;
2. conversational reasoning from Maker and Critic in their own saved surfaces.

Treating those as one process would make terminal ownership, resumability, permissions, and conversational identity ambiguous.

## Decision

Maker and Critic use a separate Claude Code print-mode provider. Each reply:

- routes Maker through Claude Opus 5 for frequent building work and Critic through Claude Fable 5 for deeper independent review;
- is a fresh, non-persisted Claude Code invocation;
- uses an exact Hearth role prompt and safe mode;
- has no tools and cannot edit, execute, browse, or inspect the project;
- receives only recent role-specific conversation, the saved handoff summary, and freshly read bounded evidence;
- gives terminal observation only to Maker;
- caps selected source evidence at 60,000 characters;
- withholds raw evidence when a credential-shaped path is present;
- has a 90-second timeout and a per-call budget ceiling;
- falls back to Hearth's deterministic local personality on failure.

The user's persistent Workshop terminal remains unchanged and has exactly one explicit owner.

The renderer can select Claude or local reasoning and displays each role's assigned or resolved model independently, along with degraded fallback state. Provider credentials, raw source evidence, and Claude sessions are not stored by Hearth.

## Consequences

- A Maker chat cannot silently type into the Workshop terminal.
- Critic remains independent and cannot receive terminal state.
- Automated tests use local mode and never consume provider usage.
- The first Claude reply may have process-start latency.
- Conversations retain their text in Hearth's SQLite database, while provider calls do not create Claude Code history.
- Future streaming and cancellation can be added behind the same provider boundary without expanding renderer privileges.
