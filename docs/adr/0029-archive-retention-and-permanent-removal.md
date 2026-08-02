# ADR 0029: Archive retention and permanent removal

## Context

Archive is intentionally generous: Return Packs, put-away captures, let-go ideas, closed handoffs,
and file-edit recovery records remain available until the user decides otherwise. Indefinite
retention is safe for continuity but creates two long-term concerns:

- old records can become clutter even when their database footprint is small; and
- file-edit recovery and automatic database snapshots occupy real disk space.

Reversible actions must remain the default. Permanent cleanup must be unmistakable and must never
silently broaden into deleting source-project files.

## Decision

Every Archive detail offers **Remove forever** behind a separate confirmation state.

The confirmation states the exact consequence:

- Return Packs and closed handoffs remove their history record.
- Put-away links and notes remove the canonical saved item.
- Let-go ideas remove the idea and its Studio conversation.
- File-recovery records remove Hearth's private original-file backup and permanently surrender
  Undo.

Permanent removal of a file-recovery record validates that the stored backup resolves inside
Hearth's private `backups/project-edits` directory and is a regular file. Project files are never
removed or modified by Archive cleanup.

Hearth also keeps only the newest eight automatic startup database snapshots. Explicit/manual
backups use a different retention class and are never pruned by this policy. Cleanup refuses paths
outside Hearth's managed backup directory and leaves uncertain records intact.

## Consequences

- Archive remains reversible until the user deliberately chooses otherwise.
- Heavy long-term use has a visible, truthful cleanup path.
- The largest automatic source of silent file growth is bounded.
- Removing SQLite records makes their pages reusable by future data; backup-file removal returns
  the associated file space immediately.
- Recovery deletion is more serious than ordinary history deletion and is presented accordingly.
