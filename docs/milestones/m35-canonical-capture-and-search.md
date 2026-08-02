# Milestone 35: Canonical capture and whole-house search

Hearth 0.30.0 turns universal capture into a predictable organization system without making the
user file everything by hand.

## Delivered

- Bare links route to Library and no longer mix with Studio material.
- `@idea` routes a thought to Studio with an explicit resting state.
- `@note` creates a loose note unless a discovered project is mentioned.
- Quoted, underscored, hyphenated, and single-word project mentions create real relationships.
- `#tags` are normalized, removed from prose, and retained for retrieval.
- Duplicate links merge useful tags, descriptions, and missing project context.
- Studio now has separate Ideas and Notes surfaces.
- Notes can be loose, connected, edited, tagged, searched, put away, and restored.
- Each Project room has a Notes tab for leaving and reading canonical project notes.
- Library shows links only; ideas and notes never leak into its active or put-away shelves.
- `Ctrl+K` and the top-bar Find action search notes, ideas, links, tags, relationships, and projects.
- Search queries SQLite directly, opens the correct room, and highlights the exact saved record.
- Librarian's bounded retrieval evidence now covers all saved household material.
- Mobile capture can infer from text or explicitly select Idea, Note, or Link.

## Verification

- Capture parsing, routing, duplicate merging, and database search are covered by unit tests.
- The real Electron flow verifies room isolation, Studio notes, project notes, result routing,
  archived idea recovery, and database-backed search.
- Project notes were visually checked at the full desktop size and at 1080 by 720 with no
  horizontal overflow.
- The existing terminal, agent handoff, Archive, mobile, tray, and relaunch continuity suite
  remains green.

## Principle

The room answers “what kind of thing is this?” The relationship answers “what does it belong
with?” Search makes both optional when the user only remembers part of the thought.

## 0.30.1 polish

- Maker's larger Workshop portrait remains fully contained inside its heading at regular and
  compact sizes.
- Connected notes can be removed from a project without deletion; the same record returns to
  Studio's Loose Notes shelf.
- Project note cards also expose **Put away** for material that should leave active surfaces.
