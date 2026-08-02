# ADR 0014: Resident-proposed project edits

## Context

Hearth can safely review and apply one user-authored file edit, while Maker and Critic already reason
over deliberately handed-off evidence. Letting either resident write directly would collapse the
separation between advice, independent review, and user authority.

## Decision

An eligible selected file exposes **Ask Maker**. The user states one change. Maker receives only that
request and the complete bounded file through a tool-free, non-persistent structured reasoning call.
Maker returns complete proposed text, a short summary, and a rationale.

The local core does not trust that result. It sends the text through the existing bounded edit engine,
which re-resolves the file, validates encoding and format, enforces size and line limits, computes the
exact diff, captures the original hash, and creates the same twenty-minute memory-only draft used for
manual edits.

The user may ask Critic for a separate structured review. Critic receives the original and proposed
file plus the visible request and bounded proposal notes. Critic receives no Maker conversation,
terminal state, or tools. A verdict may support, caution, or object, but never blocks or grants Apply.

Only the renderer's explicit user-facing **Apply this edit** action can submit the reviewed draft to
the existing atomic write and recovery path. If the user chooses **Adjust it myself**, Hearth drops
the resident attribution and Critic review; the revised text becomes a new manual draft.

## Consequences

- Maker can do useful small-file work without becoming Claude Code or owning a terminal.
- Critic remains genuinely separate and can disagree without becoming an approval authority.
- Proposal and critique have no filesystem side effects.
- Model output cannot broaden file scope, create files, execute commands, or bypass stale-file checks.
- Local mode is honest: only an exact quoted replacement is available without a reasoning model.
- Multi-file changes and automated validation remain Workshop work.
