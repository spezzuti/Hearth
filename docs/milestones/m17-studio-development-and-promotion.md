# Milestone 17: Studio development and project promotion

Hearth 0.14 lets a pursued idea become clearer before it becomes work, then gives it an explicit
path into the Project room.

## Delivered

- A separate persistent Maker conversation for every pursued idea.
- Optimistic user messages, newest-message anchoring, Enter to send, Shift + Enter for a new line,
  live Claude streaming, and cancellation inside Studio.
- A clear boundary between talking, pursuing, promoting, selecting a project, and starting work.
- Existing-project promotion using only Hearth-local metadata.
- New-project creation under the visible `Hearth Projects` shelf.
- Exact destination preview and Windows folder-name validation.
- Atomic project creation containing only `.hearth/project.json` and `IDEA.md`.
- Original idea text, capture timestamp, conversation, and promotion provenance retained.
- Promoted project identity shown directly on the idea card.
- Responsive development and promotion dialogs with bounded wrapping and scrolling.

## Current boundary

Studio cannot edit project files, initialize Git, choose a stack, install dependencies, open a
terminal, or assign work to an agent. A promoted idea remains pursuing until the user deliberately
changes its Studio state.

## Next

Add the first bounded small-file edit workflow in the Project room: explicit file selection, a
visible before/after patch, validation, approval, and reversible write boundaries. Keep agents in
the proposal and review loop without turning Project review into unrestricted filesystem access.
