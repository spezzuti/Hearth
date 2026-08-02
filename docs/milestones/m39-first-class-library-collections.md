# Milestone 39: First-class Library collections

Hearth 0.34.0 gives saved links a real place on the shelf without confusing filing, project
relevance, and search tags.

## Delivered

- A persisted optional collection for every Library link.
- Visible collection chips and counts for the current active, pinned, or put-away view.
- One-click collection filtering plus a truthful **Unfiled** shelf.
- Collection editing with suggestions from existing shelves and support for a new name.
- Card footers that show collection and project connection as separate relationships.
- Collection-aware Library search, whole-house search, Archive detail, and Librarian retrieval.
- Kept discovery repositories filed under **Repositories** and skills under **Skills**.
- PersonalOS imports preserve original collection names as collections as well as searchable source
  tags.
- Existing imported Stacks links receive an explicit **to file** reconciliation without being
  re-imported, restored, or silently changed.
- A user-selected Hearth collection always wins over a later PersonalOS reconciliation.

## Verification

- Store coverage proves collection persistence, normalization, search, Librarian evidence, original
  Stacks filing, idempotence, and protection of a later user collection.
- Real Electron coverage creates and edits a collection, filters to one collection, preserves a
  separate project connection, and excludes links from other shelves.
- A private SQLite backup of the real Hearth database migrated from schema 19 to 20, identified all
  eight previously imported links, and reconciled them to App Code (2), Design Skills (5), and
  Security (1).
- The real PersonalOS source and installed Hearth database remained untouched during the upgrade
  proof.

## Principle

Organization should answer a simple question. A collection says where the link lives; a project
says where it matters; a tag says how it may be found.
