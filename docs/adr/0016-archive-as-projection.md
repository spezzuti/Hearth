# ADR 0016: Archive as a recovery projection

## Context

Hearth already retained Return Packs, archived Library captures, let-go ideas, closed Workshop
handoffs, and restart-safe file-edit recovery. Those records lived behind their original rooms or
were unavailable after closure, making deliberate history harder to find than it needed to be.

A generic activity feed would duplicate state, encourage noisy chronology, and blur the difference
between something merely recorded and something Hearth can actually restore.

## Decision

Archive is a read-mostly projection over existing SQLite records. It does not copy records into a
second archive table. The core maps each source into one bounded, searchable record with a visible
kind, status, project context, detail fields, timestamp, and truthful action capability.

The renderer performs literal local filtering over the returned records. Opening Archive, searching,
selecting, or copying a record does not change the working project, resident context, terminal, or
source record.

Recovery stays source-specific:

- An archived Library link or note may return to the active Library shelf.
- A let-go idea may return to Studio in the resting state.
- An un-restored Hearth file edit may invoke the existing verified private-backup Undo path after a
  second user confirmation.
- Return Packs and completed or discarded handoffs are reference records. Hearth does not pretend it
  can reconstruct a past process or resume a completed decision.

The project route constraint is migrated to include Archive. No new content, search terms, copies, or
read markers are persisted.

## Consequences

- Finished work becomes findable without turning Home into a timeline.
- Restorable records advertise exact actions; historical records remain honestly read-only.
- All recovery invariants remain owned by their original systems.
- The view can be rebuilt from source-of-truth tables at any time.
- Archive is not an audit log, version-control replacement, terminal transcript, or automatic project
  resurrection system.
