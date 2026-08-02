# Workshop milestone handoff

Status: Completed in Hearth 0.2. See `m4-workshop-complete.md` for the implementation record and next handoff.

## Proven foundation

The continuity slice now proves:

- The renderer can reload without losing the selected room, project objective, conversations, or captures.
- Full application exit closes the core gracefully.
- Relaunch restores the latest Return Pack and project truth.
- Remembered intent never claims that a terminal or agent process is alive.
- Home, Study, Maker, Companion, and universal capture use persisted core state.
- The packaged Windows application can run the same continuity journey.

## Next objective

Add one real Workshop session without weakening the process boundary:

> Maker can own one interactive Claude Code session in a large Windows-quality terminal, and that session survives room navigation or renderer replacement while its exact state remains visible in Home and Study.

## Required architecture

1. Add a terminal worker owned by the local core.
2. Use ConPTY through `node-pty` for the backend and xterm.js for the viewport.
3. Register every session with:
   - Hearth session ID
   - project ID and working directory
   - process ID and process-tree identity
   - kind: PowerShell, Claude Code, or managed process
   - owner: user or Maker
   - lifecycle state: starting, running, waiting, stopped, failed, resumable
   - Claude session ID/name when available
4. Keep the viewport disposable. Scrollback and process ownership remain in the worker/core.
5. Give the renderer only bounded terminal operations: attach, detach, resize, input, copy-safe output stream, and explicit stop.
6. Do not give Critic the Maker session. Critic receives a structured handoff and runs separately in a later milestone.

## Claude Code probe

At startup, detect the installed Claude Code version and supported flags. The current machine baseline exposes named sessions, resume/continue, explicit session IDs, background sessions, worktrees, structured JSON streams, permission modes, and forwarded subagent text. Hearth must feature-detect rather than assume that this exact CLI surface never changes.

## Interaction target

- PowerShell 7 and Windows Terminal behavior are the benchmark.
- The terminal gets the largest share of Workshop by default.
- A focus mode removes room chrome without creating a separate application.
- Copy, paste, selection, search, links, resize/reflow, keyboard escape behavior, and scrollback are acceptance features.
- A session remains understandable from Home and Study even when its viewport is not mounted.

## Safety gates

- No blanket permission bypass.
- Stop and full exit operate on the known process tree and state exactly what will end.
- Updates never restart the core while a terminal is active.
- Raw terminal logs are not persisted by default.
- Environment values and terminal output do not enter general search or conversation memory.
- Renderer reload tests confirm that the PTY continues and reattaches without duplicate input or output.

## Performance watch

The optimized packaged continuity slice idles below the 500 MB working-memory budget on the development machine, with the local core around the mid-60 MB range. Repeated debugger-driven Chromium reloads retain renderer/GPU working-set pages even though the core stays flat. Workshop work should:

- keep one renderer and one window;
- avoid hidden duplicate web contents;
- cap terminal scrollback;
- measure normal navigation separately from debugger reload behavior;
- add a controlled renderer-recycle test before the daily-driver milestone;
- avoid disabling GPU globally unless terminal rendering proves equally smooth without it.

## Exit proof

The Workshop milestone is complete only when an automated and manually reviewed journey proves:

1. Open Hearth and the Hearth project.
2. Start PowerShell in Workshop.
3. Start Claude Code and capture its session identity.
4. Ask Maker to perform a bounded change.
5. Navigate to Study and Home while the session continues.
6. Reload or replace the renderer and reattach once, with no duplicate process.
7. Leave the project with the terminal either deliberately alive or deliberately stopped.
8. Relaunch and report the actual state.
9. Resume the same Claude session when requested.
10. Pass terminal interaction, process-tree, security, and memory checks.
