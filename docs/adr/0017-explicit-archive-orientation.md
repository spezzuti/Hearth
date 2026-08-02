# ADR 0017: Explicit orientation from Archive

## Context

Archive made historical records findable and recoverable, but a record still ended at its detail
pane. Useful history should help the user return to the related work without pretending a completed
process can be replayed or silently replacing the project's current truth.

Changing the selected project is persistent state. A live terminal, resident context, and a
historical Return Pack are separate kinds of state and must not be moved together by implication.

## Decision

Archive records expose source-specific orientation:

- A saved Return Pack may be viewed on Home as an explicitly historical, transient return point.
  Home continues to show the actual current project, process count, and household state. The
  historical card is never written over the latest Return Pack and disappears on dismissal,
  navigation, or renderer reload.
- A record connected to a discovered project may open that project in Study. When a safe file path
  exists, Study opens the exact bounded preview after re-resolving it through the existing project
  boundary.
- A closed handoff may orient Workshop to its project, but does not reopen the handoff, start a
  terminal, send an instruction, or grant terminal ownership.

When the destination differs from the current working project, Archive names both the target and the
state change and requires a second confirmation. The selected project is then updated through the
existing project manager. If a terminal is live in another folder, it remains there and the
interface says so plainly.

Opening historical context does not change Maker or Critic context. Missing or no-longer-discovered
projects and files fail honestly rather than falling back to a similarly named location.

## Consequences

- Archive becomes a practical return surface rather than a dead-end history viewer.
- Current state and historical reference can coexist on Home without rollback language.
- File orientation reuses the same containment, symlink, encoding, and size checks as ordinary
  Project browsing.
- Project changes remain deliberate and visible.
- Historical orientation is transient; Hearth does not persist a hidden "last archived thing read"
  preference.
