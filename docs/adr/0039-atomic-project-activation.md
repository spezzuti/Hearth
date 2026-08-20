# ADR 0039: Atomic project activation and one Workshop workstream

## Context

Study and Archive are browsing surfaces, while Workshop is the active execution surface. Earlier
iterations let project selection, terminal selection, and navigation happen as separate operations.
That allowed the saved project label, an older project conversation, and the loaded terminal record
to disagree. The earlier Archive orientation decision also allowed a live terminal to remain in its
old folder after changing the selected project.

Workshop also briefly presented a Hearth-rendered Maker conversation beside Claude Code. In daily
use that created two voices and obscured which interface actually owned the work.

## Decision

- Browsing a project in Study or opening historical context from Archive does not change the working
  project.
- **Work in _project_** is the explicit activation boundary. The core serializes the complete
  park-select-load operation so overlapping requests cannot interleave.
- If another project's ConPTY process is live, Hearth stops and parks it before persisting the new
  project selection. It then loads only the target project's stored terminal identity.
- The renderer prevents repeated activation while that operation is in flight and renders the core's
  returned project and terminal snapshot together.
- Workshop's real Claude Code TUI is the canonical Maker conversation and technical workstream.
  Maker's right rail is identity, presence, and a project-scoped notebook—not a second model chat.
- Terminal resume identity and bounded conversation history remain scoped by canonical project path.

This decision supersedes the cross-project live-terminal behavior in ADR 0017 and the split
Workshop interaction assumptions in earlier terminal-seat milestones. Their historical rationale
remains useful, but they no longer describe the current product.

## Consequences

- The visible project, Maker continuity, and loaded terminal cannot be retargeted independently.
- A project switch may intentionally stop a live process; Hearth names the parked project and never
  pretends the process moved folders.
- Rapid repeated clicks are harmless rather than producing out-of-order renderer state.
- Claude Code keeps its native modes, permissions, streaming actions, diffs, token display, and
  keyboard behavior while Hearth supplies the surrounding home, continuity, review, and memory.
