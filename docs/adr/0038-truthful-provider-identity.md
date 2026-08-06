# ADR 0038: Truthful provider identity

## Context

Hearth routes configured aliases such as `opus` and `fable`, while ACP and provider results do not
always disclose the exact model that ultimately served a turn. Earlier UI paths displayed fixed
**Claude Opus 5** and **Claude Fable 5** labels before that identity had been observed. That made a
configuration choice look like runtime evidence.

## Decision

Provider status carries model provenance as `configured`, `reported`, or `unreported`.

- Claude residents show **Claude configured Opus/Fable** until the provider supplies model evidence.
- Managed Maker reads the ACP model selector and, after a turn, the bounded Claude transcript model
  associated with the same project-scoped session.
- A reported model replaces the configured label.
- Codex is identified as the provider, not as an underlying model. Hearth does not invent a Codex
  model when ACP has not disclosed one.
- Fallback provenance remains visible independently of model provenance.

The bounded transcript read extracts only the latest top-level assistant model and usage fields; it
does not persist or expose transcript content.

## Consequences

- Resident and Workshop labels may intentionally say **configured** before the first successful
  turn.
- Model switches and provider fallbacks can become visible without a renderer hard-code.
- Future provider adapters must state whether identity was configured, reported, or unavailable.
- Compact layouts must accommodate the longer configured label without clipping or overflow.
