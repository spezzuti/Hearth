# ADR 0003: Bounded project discovery and review

Status: Accepted for Hearth 0.3

## Decision

Hearth discovers local working projects in its utility-process core and exposes a read-only Project room through narrow operations:

- list discovered projects
- select one working project
- inspect its summary
- list one relative directory
- preview one bounded text file
- review one bounded Git diff

The renderer can identify a project only by the opaque ID returned by discovery. Files are identified only by relative paths returned from a previous project operation.

## Discovery

The scanner always includes Hearth, then searches two levels beneath the Windows home folder for repository, Claude, Codex, or agent-instruction markers. It stops at a project boundary instead of walking through its worktrees and dependencies. System, cache, dependency, output, and user-media locations are excluded.

Discovery is capped at 1,200 visited directories and 80 projects. On the target machine it finds 21 relevant projects in roughly 1.4 seconds.

## Containment

Before reading anything, the core:

1. rejects absolute paths, null bytes, and parent traversal;
2. resolves the canonical project root and requested item;
3. confirms the canonical item remains inside the canonical root;
4. refuses symlink traversal;
5. rejects non-text previews and bounds returned bytes.

Git runs through `execFile` argument arrays with no shell interpolation. Diff output is bounded.

## Working-project continuity

The selected root is persisted in SQLite. Home, the top bar, Study, and the next Workshop session use the same selection. If a terminal is already live, changing the project prepares the next session rather than mutating the current process.

Claude resume always uses the original session working directory.

## Deferred

- File writes and small edits
- Staging, commit, checkout, or branch operations
- Model-generated project summaries
- Maker observations derived from structured terminal state
- Critic review handoffs
