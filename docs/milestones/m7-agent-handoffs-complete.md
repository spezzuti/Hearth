# Agent handoff milestone completion

## Proven

- The current project, selected file, or selected diff can be handed explicitly to Maker.
- The same bounded subjects can be handed separately to Critic.
- Context selection is visible, persists across relaunch, and remains independent for each agent.
- Maker gives project-aware guidance without implying access to unselected source.
- Critic has a dedicated Study surface, direct conversational voice, review concerns, and no terminal controls.
- Diff review flags broad changes, missing visible test changes, dependency movement, credential-shaped paths, schema work, and truncation.
- Terminal observation distinguishes a ready PowerShell prompt, active work, interaction-shaped attention, and failures.
- Observation text is sanitized, bounded, transient, and excluded from memory.
- Standard and 1080 × 720 Critic layouts keep the composer reachable without document overflow.
- Clipboard writes are verified and failures are reported honestly.

## Verification

- TypeScript typecheck
- Twelve unit tests
- Seven real-Electron end-to-end journeys
- Project, file, and diff handoff coverage
- Critic conversation and persistence coverage
- Terminal observation, ConPTY, resize, reload, and relaunch coverage
- Visual review at standard and compact desktop sizes
- Packaged Windows project-discovery and PTY smoke test

## Current boundary

Maker and Critic are evidence-aware local personalities, not provider-backed reasoning agents. The handoff architecture is ready for a model adapter, but Hearth does not yet claim autonomous judgment, comprehensive code understanding, or background execution.

## Next milestone

Introduce a provider adapter behind the existing context boundary:

1. preserve the current local personalities and role separation;
2. let Maker reason over only the selected evidence and explicit terminal observation;
3. let Critic review a structured Maker handoff independently;
4. expose provider identity and failure honestly; and
5. keep every terminal instruction and future edit approval-aware.
