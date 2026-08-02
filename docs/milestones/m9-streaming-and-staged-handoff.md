# Milestone 9: Live conversation and staged Workshop handoff

Hearth 0.6 makes Maker and Critic feel present while keeping execution deliberately gated.

## Delivered

- Live Claude text streaming in Study and the Workshop Maker rail.
- Calm partial-response cards with a live caret.
- Explicit Stop controls for Maker and Critic.
- Per-role provider process cancellation.
- Cancelled prompts restored to the composer.
- Cancelled prompts and partial replies excluded from saved history.
- Completed-turn refresh after renderer reload.
- `Stage in Workshop` on Maker's latest completed reply.
- Editable staged-instruction notice in Workshop.
- Existing terminal ownership and `Pass to Claude` approval gate preserved.
- Stream parsing bounded to text deltas and the existing 12,000-character reply ceiling.

## Verification

- Unit coverage for accepted and rejected Claude stream events.
- Live Opus stream proof in the production renderer/core path.
- Live cancellation proof with prompt restoration and no saved cancelled turn.
- Successful normal turn immediately after cancellation.
- Electron coverage for staging, editable draft transfer, and disabled execution without a Maker-owned Claude terminal.
- Existing continuity, resize, project review, and ConPTY workflow coverage.

## Next

Replace freeform staged replies with structured Maker proposals containing a concise instruction, rationale, expected files, and an explicit risk/approval summary.
