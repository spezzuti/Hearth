# ADR 0032: First-class Library collections

## Context

Library cards used the word **Unsorted** when a link had no project connection. That conflated two
different relationships: a project explains where material is relevant, while a collection
explains where it lives on the shelf. PersonalOS collection names survived import as tags, but the
Library could not browse or edit them as collections.

Tags, projects, and collections must remain useful together without becoming three competing
classification systems.

## Decision

Links gain one optional `library_collection` value:

- a collection is a human-readable shelf such as **Design Skills** or **App Code**;
- an empty value is shown truthfully as **Unfiled**;
- tags remain cross-cutting search terms;
- a project connection remains a separate contextual relationship; and
- pinning and putting away remain independent status choices.

Library presents status filters first and a horizontally contained collection shelf second.
Collection chips show counts for the current status view and filter with one click. Link editing can
choose an existing collection or type a new one. Collection names participate in Library search,
whole-house search, Archive detail, local Librarian retrieval, and bounded provider evidence.

Kept discovery repositories file into **Repositories** and kept skill collections file into
**Skills**. Ordinary captured links remain **Unfiled** until the user chooses otherwise.

PersonalOS reconciliation fills a missing Hearth collection from the original Stacks filing, but
never overwrites a non-empty Hearth collection. Previously imported links are presented for an
explicit one-time filing pass rather than being changed silently.

## Consequences

- **Unsorted** no longer means two unrelated things.
- The original Stacks structure is visible and browsable after migration.
- A link can be in **Design Skills**, connected to Hearth, tagged `frontend`, and pinned without any
  relationship erasing another.
- New collections require no separate management screen; they come into existence when a link is
  filed and disappear from the active shelf when empty.
- Renaming a populated collection currently means editing its links; bulk collection management
  remains unnecessary until real use demonstrates that need.
