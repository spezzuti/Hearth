# Milestone 19: Resident-proposed project edits

Hearth 0.16 lets the household help with one deliberately selected file while preserving the user's
sole write authority.

## Delivered

- **Ask Maker** beside eligible file previews.
- Plain-language, one-file change request surface.
- Tool-free Opus structured draft containing complete proposed text, summary, and rationale.
- Honest local fallback limited to exact quoted replacement requests.
- Every proposal routed through the existing bounded diff, validation, expiry, and concurrency checks.
- Maker's reasoning displayed beside the exact patch with explicit no-Apply language.
- Optional independent Fable Critic review over original and proposed text only.
- Support, caution, and object verdicts with concerns and suggested checks.
- No Maker conversation, terminal state, or broader project context transferred to Critic.
- **Adjust it myself** converts the proposal back into a manual draft and drops resident attribution.
- User-only Apply, atomic replacement, private backup, verification, and restart-safe Undo unchanged.
- Wide and compact desktop containment coverage.

## Current boundary

Residents can propose and review one existing bounded file. They cannot create or rename files,
change multiple files, run tests, use the terminal, install tools, stage, commit, or press Apply.

## Next

Improve project-aware retrieval so Maker can help the user deliberately choose the right evidence
before entering either a bounded edit or a Workshop session, without silently widening context.
