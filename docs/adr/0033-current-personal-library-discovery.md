# ADR 0033: Current, personal Library discovery

## Context

The original Discovery shelf was live and project-aware, but GitHub search could still return items
that only barely matched. A sports data project mentioning coding agents or an unrelated repository
mentioning skills could displace something useful. Recommendations already saved in Library could
also remain visible until the next refresh. One combined filter made it harder to deliberately
browse dependable tools, strange emerging work, and reusable skills.

Discovery should feel editorial without pretending Hearth can verify or endorse a repository.

## Decision

Discovery keeps four bounded public GitHub searches and a four-hour local cache, then applies a
second local curation pass:

- a skill requires multiple visible skill and agent-workflow signals;
- a low-star emerging repository requires real topic or description substance;
- obviously narrow specialist domains stay out unless the user's saved Library collections or tags
  show a matching interest;
- selected-project language and purpose, reversible keep/hide feedback, and bounded vocabulary from
  saved collections and tags provide modest ranking signals;
- an exact URL already saved in Library is removed from the active feed in both the core and the
  renderer; and
- dependable and emerging results remain balanced so popularity cannot consume the shelf.

The Library exposes **Curated**, **Dependable**, **Emerging**, **Skills**, and **Hidden** views.
Freshness is visible at shelf level and each card shows a relative update age. Recommendation reasons
remain short and name the selected-project or saved-Library signal when one affected the result.

Discovery remains advisory. **Inspect** opens the public repository and **Keep** creates an ordinary
Library link filed under **Repositories** or **Skills**. Hearth never clones, installs, executes, or
silently saves a recommendation.

## Consequences

- A current shelf is easier to browse according to intent rather than as one long feed.
- Saved material quietly improves relevance without becoming an uninspectable behavior profile.
- Highly specialized work can still appear when the Library demonstrates that it is relevant.
- Metadata-only curation can produce false positives or false negatives; **Not for me**, **Put back**,
  and manual refresh keep the system reversible.
- GitHub's public API and metadata remain the source of truth for freshness, not a bundled list that
  goes stale inside the application.
