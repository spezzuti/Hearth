# ADR 0006: Agent streams and staged execution

## Status

Accepted for Hearth 0.6.

## Context

Maker and Critic could reason through bounded Claude Code calls, but the renderer showed only a waiting indicator until the complete answer arrived. Maker could also discuss an action without a safe way to carry that text into Workshop.

Streaming must not weaken the existing separation between conversational reasoning and the persistent Workshop terminal.

## Decision

Claude-backed conversations use Claude Code stream JSON and expose only text deltas through a dedicated core event channel.

- The utility-process core owns the provider process.
- The renderer receives bounded text deltas but no raw provider protocol.
- A side-conversation process can be cancelled by role.
- Cancellation never stops, writes to, or changes ownership of the Workshop terminal.
- Cancelled partial output and its user prompt are not written to conversation history.
- The prompt returns to the composer after cancellation.
- Completed replies are stored before a completion event is emitted.
- A renderer that reloads during a turn refreshes saved conversation when completion arrives.

A completed Maker reply may be staged into Workshop:

- staging copies bounded text into an editable Workshop draft;
- staging navigates but does not start or resume a terminal;
- staging does not grant Maker terminal ownership;
- passing remains disabled unless a live Claude Code terminal is explicitly owned by Maker;
- the user must review the draft and press the pass button.

## Consequences

- Conversation feels responsive without persisting incomplete prose.
- Stop is local to the active household agent.
- One active provider process per role prevents overlapping turns.
- Full Maker replies may need editing before becoming good terminal instructions.
- Future structured proposals can replace freeform staged text behind the same approval boundary.
