# ADR 0035: Supervised House Practices

## Context

Hearth should notice a few durable workflow habits, but hidden behavioral learning would undermine
the product's central trust model. A repeated action is evidence of a possible preference, not
permission to automate it. Conversation text, terminal output, source files, and captured material
also contain too much unrelated and sensitive detail to serve as an implicit training set.

## Decision

House Practices extend the existing House Memory drawer instead of creating a skill engine or
background agent. Hearth may derive a small allowlisted set of suggestions from explicit lifecycle
metadata. Version 0.52.0 recognizes the usual Workshop session type and repeated project returns.

Every practice exposes:

- its house or project scope;
- the number of supporting lifecycle records;
- sanitized provenance labels;
- a proposed conversational effect; and
- a plain-language reason for the suggestion.

A suggestion is inert until the user adopts it. The user may edit it first, dismiss it, restore it,
correct it after approval, or forget it. Waiting evidence can refresh, but adoption or dismissal
freezes the record. A dismissed or forgotten observed practice remains as a suppressed local record
so the same observation cannot quietly return.

Approved practices enter resident context only as untrusted guidance. They cannot grant tools,
terminal ownership, filesystem access, provider or mode choice, installation, verification,
permission approval, or destructive authority. Hearth does not generate executable skills.

## Consequences

- The house can become more familiar while every learned behavior remains visible and reversible.
- Users see the evidence and effect before accepting anything.
- Practice detection remains intentionally narrow and may miss useful habits.
- More practice families require explicit metadata definitions and their own privacy and authority
  review; a general inference engine is not implied by this decision.
- Shareable skills remain deferred until provenance, signatures, update review, and uninstall
  behavior have separate designs.
