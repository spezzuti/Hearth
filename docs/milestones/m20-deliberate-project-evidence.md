# Milestone 20: Deliberate project evidence

Hearth 0.17 adds a visible, bounded bridge between browsing a project and asking a resident for useful
multi-file judgment.

## Delivered

- **Find context** from the Project room.
- Literal case-insensitive filename and content search with one-line snippets.
- Explicit limits for directories, files, per-file bytes, total bytes, and result count.
- Core-enforced exclusion of links, generated folders, hidden settings, credentials, keys, lockfiles,
  binaries, minified output, and unsupported formats.
- A visible six-file evidence shelf seeded by the currently previewed file.
- Add, remove, clear, and separate **Send to Maker** / **Send to Critic** controls.
- Persisted evidence paths and metadata without persisted source or search history.
- Current source refreshed and revalidated only for a relevant resident turn.
- Combined resident evidence capped at 60,000 characters and labeled by file.
- Existing social-turn context withholding preserved.
- Compact 1040×700 containment coverage through evidence search, selection, Maker conversation, and
  Workshop proposal handoff.

## Current boundary

The evidence shelf is not a repository index, semantic search engine, or autonomous context picker.
Residents receive only the exact paths the user selected. Search and selection do not run a model,
start Workshop, execute code, or write to the project.

## Next

Build Archive as a calm recovery and history room: completed work, dismissed ideas, archived Library
items, prior Return Packs, and Hearth edit recovery should become findable without turning Home into
a feed or introducing gamification.
