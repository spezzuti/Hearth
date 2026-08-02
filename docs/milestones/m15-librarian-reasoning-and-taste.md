# Milestone 15: Librarian reasoning and taste

Hearth 0.12 gives the Library a real conversational intelligence and a restrained learning loop.

## Delivered

- Librarian routed through Claude Opus 5 when the Claude Code provider is active.
- A distinct warm, intelligent, down-to-earth Librarian voice with an understated alt streak,
  natural conversational rhythm, and compact default answers.
- Visual character and spoken voice kept deliberately separate: plain conversational wording,
  direct corrections, and no performative metaphors or canned assistant sign-offs.
- Casual check-ins are isolated from catalog evidence and prior-task history, so residents answer
  the social turn instead of volunteering work status or corrections.
- Shared turn-intent rules keep Maker, Critic, and Librarian from treating conversation history as
  a backlog they must finish.
- User messages appear in every conversation immediately while the resident is responding.
- Companion, Librarian, Critic, Study Maker, and Workshop Maker open at the newest message and
  remain anchored there as streamed replies grow.
- Local retrieval limited to the most relevant saved items and current recommendations.
- Explicit separation from terminal state, arbitrary project files, and provider tools.
- Visible Librarian model/fallback label and a working Stop control.
- Original message restoration after a stopped response.
- Deterministic local Librarian fallback when Claude is disabled or unavailable.
- **Not for me**, Hidden, and **Put back** recommendation actions.
- Kept and dismissed language/topic signals persisted locally.
- Modest taste-aware ranking that preserves dependable and emerging lanes.
- Personalized recommendation reasons when a result resembles previously kept material.
- Enter sends and Shift+Enter adds a new line in every household chat, including Companion,
  Librarian, Critic, and both Maker surfaces.

## Current boundary

Librarian can reason only over the bounded retrieval packet supplied for the current message. She
cannot mutate the catalog through chat. Feedback learns from explicit Keep and **Not for me**
choices; it does not infer taste from dwell time, clicks, or passive behavior.

## Next

Move into bounded small-file edits and review approval, or begin the Studio room for developing and
deciding which resting ideas deserve to become active projects.
