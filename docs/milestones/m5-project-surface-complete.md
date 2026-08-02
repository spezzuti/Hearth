# Project Surface milestone completion

## Proven

- Hearth discovers repository and clear Claude/Codex projects under the signed-in user's Windows home folder.
- Real-home discovery finds 21 relevant projects in about 1.4 seconds on the target machine.
- Search and refresh keep a stale catalog from becoming permanent.
- The Project room previews folders and bounded text without exposing arbitrary filesystem access.
- Binary files, traversal attempts, and links outside the project root are refused.
- Git status, complete diffs, and per-file diffs are available as read-only review.
- Exact code layout and optional text wrapping both remain available.
- Long names and paths truncate visually without losing copyable full values.
- Working-project selection persists and becomes the next PowerShell or Claude Code working directory.
- An already-running terminal is never silently redirected.
- The Project room fits at 1440 × 900 and collapses cleanly at 1080 × 720.
- The Companion no longer floats over Study review content; Maker remains one click away.

## Current boundary

Maker conversation is still local and personality-shaped rather than backed by a model. Hearth can show real files and diffs, but Maker does not yet reason over them automatically. Project review is intentionally read-only.

## Next milestone

Structured agent observation and review:

1. Derive bounded, non-persisted terminal observations such as command state, approval prompts, and waiting state.
2. Give Maker explicit project/file/diff context chosen by the user.
3. Add a separate Critic handoff packet with a recognizable perspective and no shared terminal ownership.
4. Add approval-aware lifecycle events and decisions.
5. Consider bounded, preview-first small edits only after review and recovery semantics are defined.
