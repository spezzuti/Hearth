# ADR 0010: Useful Library curation with bounded network access

## Context

Universal capture made links easy to keep, but a flat list grows stale and noisy. Hearth also needs
current repo and skill recommendations without silently becoming a general browser or trusting
every captured URL.

## Decision

Captures gain editable titles, notes, normalized tags, pinning, and reversible archiving. Exact
normalized links resolve to the existing item; resaving an archived link restores it. User-entered
metadata always wins over later page enrichment.

Page enrichment is an explicit local-core operation. It resolves and rejects private destinations,
rechecks redirects, accepts only capped HTML, and extracts only a title and description.

Discovery searches GitHub for two repo lanes—established and emerging—and separate Claude Code and
Codex skill lanes. Repo searches include the selected project’s primary language and a purpose word
from its name or description. Results are filtered again using visible repository metadata, ranked,
cached for four hours, and labeled with the reason they appeared. ADR 0033 adds saved-Library taste,
stronger candidate evidence, saved-link suppression, and explicit discovery lanes.

Discovery items remain recommendations. Hearth never saves one into the user’s collection until the
user chooses **Keep**.

## Consequences

- Library organization remains light enough to use during capture.
- Current recommendations survive temporary network or API failure without pretending to be fresh.
- GitHub’s anonymous search limits can reduce refresh availability; an existing environment token
  improves the limit without adding credential storage to Hearth.
- Project fit remains explainable and intentionally modest. Explicit keep/hide feedback and saved
  Library vocabulary refine ranking without creating an opaque profile.
