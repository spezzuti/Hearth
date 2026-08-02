# Workshop milestone completion

Status: Completed in Hearth 0.2. The Project Surface described below was completed in Hearth 0.3; see `m5-project-surface-complete.md`.

## Proven

- Windows PowerShell runs in a real ConPTY session inside Hearth.
- Claude Code 2.1.220 is detected locally, including named sessions, explicit session IDs, and resume support.
- Terminal ownership remains in the local core while the renderer is disposable.
- Home, Study, and Workshop report one consistent process truth.
- Navigation and renderer reload reattach to the same PID.
- Full app exit stops the PTY and relaunch reports it stopped.
- Claude session identity is persisted for explicit resume.
- Maker has a natural side conversation and an explicit instruction relay when given control.
- Terminal output is not persisted.
- Paste is single-path, links require Ctrl+click, search works, and long lines reflow through compact and expanded sizes.
- Focus mode removes house chrome without opening another application.

## Verified layouts

- 1440 × 900 default Workshop
- 1080 × 720 compact Workshop
- full-window terminal focus mode

Automated checks assert that the terminal host does not develop horizontal or vertical layout spill after resize.

## Next milestone

Project Surface:

1. Discover Claude/Codex projects under the signed-in user's Windows home folder.
2. Add a safe project switcher and working-directory selection.
3. Add a file tree, diff review, and bounded text edits without exposing raw filesystem access to the renderer.
4. Give Maker structured terminal observations without persisting raw output.
5. Add approval-aware Claude Code lifecycle events and waiting-state detection.
6. Prepare a separate structured handoff for Critic rather than sharing Maker’s terminal.
