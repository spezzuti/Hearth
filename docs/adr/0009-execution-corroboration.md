# ADR 0009: Corroborate reports without attributing changes

## Context

Claude Code can return a useful bounded execution report, but that report is still a claim.
Hearth already has a safe Git inspection boundary and an independent Critic role.

## Decision

After a report arrives, Hearth compares its normalized changed-file paths with the current
Git working tree for the project captured on the original proposal. The result is `matched`,
`partial`, `mismatch`, or `unavailable`, with explicit reported-but-missing and
observed-but-unreported path lists.

This corroboration proves only that paths are currently visible in Git. It does not prove
who changed them, when they changed, or that Claude Code's validation claims are true.

The user may deliberately send the completed report to Critic. That creates a new Critic
diff context containing the report summary, discrepancies, and the current bounded Git diff.
It does not share Maker's conversation, terminal transcript, or terminal ownership.
