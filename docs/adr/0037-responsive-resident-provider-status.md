# ADR 0037: Responsive Resident Provider Status

## Context

Maker's Workshop header placed the provider name and online light at the far right of a narrow
resident rail. The one-line label truncated **Claude Opus 5** to **Claude Op...** at ordinary
widths, disappeared entirely below 1160 pixels, and left the light visually cramped against the
card edge. That made a useful status indicator look accidental.

## Decision

Maker's provider status is one intentional lockup:

- Claude provider names split semantically into a family line and model line, such as
  **Claude** / **Opus 5**;
- other provider names remain a complete single line;
- the provider and online light share a fixed, internally spaced group;
- the light retains a minimum gap from the label and a minimum inset from the header edge; and
- the provider remains visible from the wide three-column Workshop through the two-column compact
  layout at Hearth's 1040-pixel minimum width.

The full provider name remains available through the group's accessible label and tooltip.

## Consequences

- The configured Maker model is readable without consuming more vertical rail space.
- Online status looks aligned with the resident rather than pinned to the window edge.
- Future resident/provider combinations should use semantic line splitting instead of truncation or
  breakpoint-based hiding.
