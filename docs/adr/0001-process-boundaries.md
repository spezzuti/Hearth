# ADR 0001: Process boundaries for the continuity slice

Status: Accepted for the first vertical slice

## Decision

Hearth uses three explicit trust zones:

1. A sandboxed Electron renderer owns presentation and local interaction state.
2. Electron main owns window lifecycle and a narrow, validated preload bridge.
3. An Electron utility process owns SQLite, Return Packs, conversations, captures, backups, and later terminal/agent registries.

The renderer receives purpose-built operations. It never receives raw filesystem, shell, database, process, or IPC handles.

## Why

The interface must be free to reload without ending work or losing project truth. Privileged state therefore cannot live in React or depend on one renderer lifetime. The same boundary will later let ConPTY sessions and execution adapters survive room navigation while remaining unavailable to untrusted UI content.

## Continuity law

- Stored intent does not imply a running process.
- A Return Pack is assembled from explicit state and evidence.
- The local core is the authority for project state.
- Renderer reload must preserve the selected room, objective, conversations, and captures.
- Full exit may end the core, but reopening reconstructs the same truthful project state from SQLite.

## Database and backup lifecycle

- SQLite uses WAL mode, foreign keys, and a five-second busy timeout.
- Schema changes are versioned in `schema_migrations`.
- Existing databases receive an online backup on startup before later migrations are allowed to run.
- Backups live beside application data, not in the project repository.
- The renderer never receives the database path.

## Deferred

- Direct provider-backed agent reasoning
- Provider credentials
- Remote/mobile transport
- PersonalOS Stacks import

ConPTY ownership was implemented by ADR 0002. Bounded project discovery and review are implemented by ADR 0003.
