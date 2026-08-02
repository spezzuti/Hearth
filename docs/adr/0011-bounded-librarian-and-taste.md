# ADR 0011: Bounded Librarian reasoning and reversible taste

## Context

Local keyword retrieval can find a known link, but it cannot comfortably compare several items,
connect them to the user’s intent, or explain why a recommendation may be worth keeping. Discovery
also needs a taste signal without becoming an opaque engagement algorithm.

## Decision

Librarian joins the separate Claude Code print-mode provider as a reasoning role on Opus. She
receives no terminal observation, project source, filesystem access, browser, or tools. A local
retrieval step selects at most twelve saved items, eight current recommendations, and a compact
feedback summary. Catalog content is JSON-delimited as untrusted data and the provider invocation is
fresh, non-persisted, bounded, cancellable, and covered by the existing timeout and budget ceiling.

Librarian’s role is warm, down to earth, gently opinionated, and conversational. She may compare,
connect, and criticize the supplied material, but she must not claim to open, install, clone, save,
dismiss, edit, or verify anything. The existing deterministic Librarian remains the fallback.

Discovery adds three feedback states: none, kept, and dismissed. **Not for me** moves an item to a
reversible Hidden shelf. Keeping a recommendation records that choice after the link is safely
added to the collection. Feedback contributes modest language and topic weights on the next
refresh; selected-project relevance, freshness, and the dependable/emerging lane balance remain the
stronger signals. Personalized reasons say when a result resembles previously kept material.

## Consequences

- Librarian can discuss the Library naturally without inheriting the Workshop terminal or full
  catalog.
- The user can stop a slow Librarian response and gets the original message back in the composer.
- Feedback improves future ranking while remaining inspectable and reversible.
- A single dismissal cannot erase an entire language or remove the emerging lane.
- Hidden recommendations may disappear from the current Hidden shelf after a later GitHub refresh,
  but their compact taste signal remains until explicitly replaced by a later choice.
