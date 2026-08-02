# ADR 0007: Structured Maker proposals

## Status

Accepted for Hearth 0.7.

## Context

Hearth 0.6 proved that a completed Maker reply could be copied into Workshop without weakening terminal ownership. Full conversational replies, however, are rarely ideal Claude Code instructions. They mix recommendation, explanation, caveats, and conversational texture, leaving the user to reconstruct the executable request.

Proposal generation also consumes model budget, so it should not happen during every ordinary Maker conversation.

## Decision

A completed Maker reply can deliberately create one structured Workshop proposal.

- Creation is a separate, bounded Opus call initiated by the user.
- Claude Code receives the completed reply plus only Maker's saved context summary, evidence notes, and concerns.
- The provider returns schema-validated fields: instruction, rationale, expected files, risk, and risk summary.
- If Claude is unavailable, Hearth creates a conservative local proposal and labels unverified risk as unknown.
- Raw source evidence is not copied into the proposal.
- Only one active draft exists; preparing another safely retires the previous draft.
- Drafts and edits persist in SQLite across room changes, renderer reloads, and relaunch.
- Talk to Maker remains a separate composer from the execution proposal.
- Discard records a non-execution outcome.
- Passing still requires a live Claude Code terminal explicitly owned by Maker and a final user click.
- A proposal is marked passed only after the terminal accepts the reviewed instruction.

## Consequences

- Maker conversation remains natural while Workshop instructions become concise and reviewable.
- Rationale and risk stay visible without being injected into the terminal.
- Model usage occurs only when the user asks for a handoff.
- Structured output failure degrades safely to a local draft.
- Expected files are advisory rather than a claim that the files were inspected.
