# Milestone 10: Structured Maker proposals

Hearth 0.7 turns a useful Maker recommendation into a durable approval surface rather than a pasted chat transcript.

## Delivered

- Deliberate `Prepare Workshop handoff` action on Maker's latest completed reply.
- Separate bounded Opus proposal call with strict structured output.
- Conservative local fallback when Claude Code is unavailable.
- Editable, self-contained Claude Code instruction.
- Maker rationale shown outside the executable instruction.
- Expected file and area scope.
- Low, medium, high, or unknown risk with an explicit approval note.
- One persistent active draft across navigation, reload, and relaunch.
- Explicit save and discard actions.
- Existing live-Claude, Maker-ownership, and final-pass gates preserved.
- Proposal completion recorded only after the terminal accepts the instruction.
- Compact Workshop layout rebalanced around proposal review.

## Verification

- 22 unit checks across five files.
- Live Opus 5 structured-output compatibility proof.
- Electron coverage for local fallback creation, editing, reload persistence, compact containment, and disabled pass without a live Maker-owned Claude terminal.
- Existing seven-workflow Electron continuity and ConPTY suite remains green.

## Next

Let Claude Code report a bounded execution result back into the proposal: changed files, validation performed, unresolved concerns, and the exact decision needed from the user.
