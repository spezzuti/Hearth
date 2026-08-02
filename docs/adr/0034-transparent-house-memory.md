# ADR 0034: Transparent House Memory

## Context

Hearth should learn the durable parts of the user's working life: projects they return to, preferred
tools, useful structure, and the way each resident should relate to them. That continuity is only
helpful if it remains legible. A hidden behavioral profile, transcript-mining system, or resident
that unexpectedly volunteers stale work during casual conversation would make the home feel less
trustworthy rather than more personal.

## Decision

House Memory is one compact drawer on Home, not another room. It holds explicit, bounded records in
five categories: preference, workflow, tool, project, and resident. Every record has a visible scope:
the whole house, one project, or one resident.

User-authored memories become active immediately. Hearth may derive a small set of observations from
terminal session metadata—session kind, selected working directory, and repeat count—but those remain
visible suggestions until the user chooses **Remember this**. Conversation text, terminal output,
source files, captures, and clipboard contents are never mined.

Only approved records may reach a resident. Local selection enforces project and resident scope,
limits work turns to twelve records and 6,000 characters, and limits casual turns to four
resident-scoped relationship records and 1,600 characters. Memory is untrusted context and never
changes an authority boundary.

Approved memories participate in whole-house search. Suggested and dismissed observations remain in
the drawer. Dismissal is reversible and suppresses regeneration; forgetting a user-authored memory
removes it.

## Consequences

- Hearth can become more familiar without asking the user to trust an invisible dossier.
- Corrections take effect at the source rather than relying on another conversational correction.
- Ordinary greetings stay ordinary because general work memory remains out of casual turns.
- Automatic learning is deliberately modest; richer inference can be considered later only if it
  can preserve the same approval, scope, provenance, and authority boundaries.
- Dismissed observations occupy a small amount of local storage so Hearth can honor the user's
  decision not to suggest them again.
