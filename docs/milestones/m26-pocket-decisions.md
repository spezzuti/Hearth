# Milestone 26: Pocket decisions

Hearth 0.22.0 gives the private phone surface a small, useful decision inbox without turning it
into a remote-control panel.

## Delivered

- Recent active ideas appear in a dedicated **Decisions** surface.
- **Pursue**, **Let rest**, and **Let go** use Studio's existing persistent, reversible idea state.
- A phone decision refreshes the open desktop from authoritative core state and receives a quiet
  acknowledgement there.
- The current Maker plan or execution report appears as a bounded read-only summary.
- Maker summaries include status and aggregate report counts, never expected paths, changed-file
  names, observed files, terminal output, or project contents.
- Draft approval, Claude Code handoff, Critic handoff, report closure, and execution remain desktop
  decisions.
- When Workshop is explicitly waiting for input, the open Companion page shows a calm attention
  banner and updates its browser title.
- Companion polls while open, but does not request browser notification permission or claim
  background push support.
- Responsive coverage exercises the real decision controls at 320, 390, and 430 pixels.
- Boundary tests prove terminal, proposal approval, file, and apply routes remain unavailable.

## Product boundary

Phone decisions are limited to state that is safe to reverse and already belongs to Hearth. They
cannot approve a Maker proposal, pass anything to Claude Code, type into a terminal, alter project
files, apply an edit, change terminal ownership, or switch the working project.

The decision endpoint accepts only an existing capture identifier and one of three fixed idea
states. The local core still validates that the capture is an idea before changing it.

## Quiet attention

Attention is intentionally in-app for this milestone. The page refreshes every fifteen seconds and
surfaces Workshop only when its bounded observation says input is required. Closed-page mobile push
and Windows notifications remain separate future work because they require explicit delivery and
preference design rather than a browser permission prompt hidden inside this feature.
