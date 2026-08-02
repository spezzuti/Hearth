# ADR 0013: Bounded project edits with persistent recovery

## Context

The Project room began as a deliberately read-only review surface. The user sometimes needs to make
a small correction without leaving Hearth, but a generic filesystem bridge or agent-owned write
would erase the trust boundary that makes the room useful.

## Decision

Hearth permits editing only after the user previews one eligible existing file and chooses
**Edit file**. Eligibility is decided again in the local core: the canonical regular file must remain
inside a discovered project, use an allowlisted UTF-8 text format, fit within 128 KiB and 800 lines,
and not resemble credentials, keys, generated output, or a dependency lockfile.

The renderer edits a local draft. Review sends the proposed text to the core, which validates format
and bounds, computes an exact line comparison, and retains the original and proposed bytes in a
short-lived in-memory draft identified by a UUID. Nothing is written at this stage.

**Apply this edit** is a second operation. The core re-resolves the path, verifies the original hash,
writes a private backup, rechecks the file, performs a same-directory atomic replacement, and
verifies the applied hash. The database stores only recovery metadata; backup paths and hashes do
not enter renderer contracts.

Undo survives restart. It is permitted only while the current file still matches the exact applied
hash, so later work is never knowingly replaced. Recovery writes are also verified.

## Consequences

- Small corrections can happen inside Hearth without turning Project review into a filesystem API.
- Drafting and reviewing have no disk side effects.
- Concurrent terminal, editor, or agent work causes Apply or Undo to stop rather than overwrite.
- Line-ending style, UTF-8 BOM, and file mode are preserved.
- Hearth does not create files, delete files, run commands, stage changes, commit, or choose a branch.
- Agent-authored patch proposals remain a later layer built on this user-controlled mechanism.
