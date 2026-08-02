# Milestone 18: Bounded project edits and recovery

Hearth 0.15 adds the first intentionally narrow write capability to the Project room.

## Delivered

- **Edit file** appears only for eligible selected previews.
- One-file UTF-8 allowlist with 128 KiB and 800-line limits.
- Credential, key, lockfile, minified-output, binary, symlink, and traversal refusal.
- Comfortable monospaced editor with no writes during drafting.
- Separate review step with exact added, removed, and context lines.
- Visible path, size, format, scope, and concurrency validation.
- JSON parse validation before review.
- Twenty-minute, memory-only, UUID-bound draft previews with a twelve-draft cap.
- Separate Apply approval with repeated hash and path checks.
- Same-directory atomic replacement, preserved line endings, BOM, and file mode.
- Private original-byte backup before every applied edit.
- Persistent edit history and restart-safe Undo.
- Undo refusal when any newer work changed the file.
- Wide and compact review layouts with bounded horizontal and vertical scrolling.

## Current boundary

The editor changes one existing file only. It cannot create, rename, delete, stage, commit, checkout,
run tests, install tools, or execute a command. Maker and Critic can still discuss the selected file
through their existing evidence handoffs, but they cannot author or approve this patch.

## Next

Let Maker propose a bounded patch from deliberately selected file evidence, let Critic challenge the
proposal independently, and keep the user as the only Apply authority. Reuse this edit engine rather
than granting either resident direct filesystem access.
