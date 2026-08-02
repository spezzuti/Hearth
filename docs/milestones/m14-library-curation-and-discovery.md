# Milestone 14: Library curation and live discovery

Hearth 0.11 turns the Library foundation into a shelf that can stay useful over time.

## Delivered

- Editable names, notes, and normalized tags.
- Pin, unpin, put-away, and restore actions.
- Exact-link deduplication, including restoration of archived links.
- Guarded page-title and description enrichment.
- Collection and Discover surfaces in one calm Library room.
- Current GitHub repo recommendations split between dependable and emerging work.
- Relevance based on the selected project’s primary language and purpose.
- Dedicated Claude Code and Codex skill searches.
- Six-hour local cache, manual refresh, and honest stale/offline states.
- One-click **Keep** that preserves recommendation context without overwriting existing curation.
- Librarian retrieval across titles, notes, tags, project connections, and discovery items.
- Compact-window overflow checks for the expanded Library.

## Current boundary

Librarian still uses fast local catalog retrieval. Discovery currently uses public GitHub repository
metadata and does not clone, install, or execute a recommendation. Hearth has no like/hide feedback
loop yet, so relevance learns from the active project but not from explicit taste signals.

## Next

Completed in Milestone 15: provider-backed bounded Librarian reasoning and reversible discovery
feedback that modestly shapes future ranking.
