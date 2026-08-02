# ADR 0031: Deliberate PersonalOS Stacks bridge

Collection handling in this decision is superseded by ADR 0032. The read-only, active-only,
deduplicated import boundary remains unchanged.

## Context

PersonalOS already contains a small, useful Stacks library. Re-entering those links by hand would
create clerical work, but silently absorbing the old database would blur the boundary between the
fallback product and Hearth. Released links also represent decisions that should not be undone by
a migration.

The bridge needs to remain useful after the first run. A one-time bulk copy would become stale, and
an automatic background sync would make ownership and archive behavior difficult to understand.

## Decision

Library detects the fixed PersonalOS database beneath the Windows home folder and offers a visible
review drawer when active links are available.

The bridge:

- opens the PersonalOS SQLite database read-only;
- reads active links only and leaves released records behind;
- shows every candidate and its collection before importing;
- converts collection names into normalized, searchable Hearth tags;
- deduplicates by exact URL;
- merges missing metadata without replacing a better Hearth title;
- never restores a matching Hearth item the user already put away; and
- may be rerun safely, importing only links Hearth does not already know.

The source path is not user-selectable. Symlinks, non-files, paths outside the expected PersonalOS
root, malformed rows, and unreadable databases fail closed. Import writes only to Hearth's own
store and records one bounded activity summary.

## Consequences

- Existing Stacks arrive without duplicate cleanup or reclassification work.
- PersonalOS remains a genuine fallback and is never modified by Hearth.
- Collection identity survives as useful search language rather than a second collection system.
- Old release decisions stay respected on both sides of the boundary.
- The review step keeps migration deliberate without turning it into a technical import wizard.
- The bridge is intentionally one-way; later edits in Hearth do not synchronize back to PersonalOS.
