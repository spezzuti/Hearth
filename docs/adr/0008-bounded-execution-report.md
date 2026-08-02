# ADR 0008: Bounded execution reports from Claude Code

## Context

A structured Maker proposal could be reviewed and passed into the persistent Claude Code
terminal, but Hearth immediately put the proposal away. The user then had to reconstruct
what happened from the terminal transcript. Giving Maker the entire transcript would blur
the separate-agent boundary and create a large, noisy, potentially sensitive memory path.

## Decision

Hearth appends a visible reporting request to an explicitly approved proposal as it enters
Claude Code. The request asks for one delimited JSON object containing only:

- paths Claude Code says it changed;
- validation Claude Code says it performed;
- unresolved concerns;
- the exact decision or next action needed from the user.

The local terminal core watches a capped, transient output probe for that object. Raw output
remains in the existing bounded terminal scrollback and is never persisted. Only the four
bounded result fields are stored with the proposal and shown in Workshop.

Maker may receive that stored report in a later sidebar conversation. The prompt labels it
as Claude-reported and not independently verified. Critic receives none of it unless the
user deliberately creates a separate handoff.

The passed proposal remains visible as `Work in progress` until a report arrives or the
user stops tracking it. A returned report remains visible until the user marks it done.
Neither action stops, resumes, or silently writes to Claude Code.

## Consequences

- Claude Code and Maker remain separate sessions with separate context.
- The user gets a durable return path without storing a terminal transcript.
- A report is useful evidence, not proof. Future Git and validation corroboration can be
  layered beside it without changing this boundary.
- Claude Code may omit or malformedly format a report. Hearth then continues to show the
  honest waiting state and allows tracking to be stopped explicitly.
