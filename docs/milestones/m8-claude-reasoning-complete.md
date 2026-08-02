# Milestone 8: Claude-backed household reasoning

Hearth 0.5 gives Maker and Critic real Claude-backed conversation without merging them with the Workshop terminal.

## Delivered

- Claude Code provider detection using the user's existing installation.
- Fresh, tool-less, non-persisted reasoning calls for Maker and Critic.
- Claude Fable 5 model identity surfaced after a successful response.
- Explicit Claude/local selection in Study.
- Visible local fallback when Claude is missing, slow, or fails.
- Role-specific prompts preserving Maker's natural builder voice and Critic's skeptical, sharper perspective.
- Fresh bounded file or diff evidence read only when the user sends a message.
- 60,000-character evidence ceiling and sensitive-path withholding.
- Maker-only terminal observation; Critic receives no terminal state or control.
- Existing deterministic personalities retained as private, fast fallback behavior.
- Provider choice persisted locally.
- Automated tests pinned to local mode so test runs never create provider charges.

## Verification

- TypeScript contract and build checks.
- Unit coverage for prompt boundaries, Critic isolation, preference persistence, and sensitive evidence withholding.
- Existing continuity, project review, clipboard, resize, and ConPTY end-to-end coverage.
- Live in-app Claude Code smoke proof using the production renderer/core path.
- Standard and compact Critic layout checks at 1440×900 and 1080×720.
- Packaged Windows application smoke test.

## Next

Introduce streamed replies and explicit cancellation, then let Maker propose an approval-aware handoff into the existing Workshop terminal without granting conversational reasoning direct execution authority.
