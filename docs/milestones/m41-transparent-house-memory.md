# Milestone 41: Transparent House Memory

Hearth 0.36.0 gives the household durable continuity without turning it into a hidden profile.

## Delivered

- A polished **What the house remembers** drawer on Home.
- Explicit memories for preferences, workflows, tools, projects, and resident relationships.
- Whole-house, selected-project, and individual-resident scopes.
- Add, correct, forget, approve, dismiss, restore, and review-ignored controls.
- Bounded suggestions based only on repeated Claude Code use and projects revisited through Workshop.
- Clear source labels separating user-authored memories from observed suggestions.
- Approved-memory retrieval for relevant resident turns with stricter social-conversation handling.
- Whole-house search over approved memories with direct return to the Memory drawer.
- Compact-window containment and internal scrolling without widening the app.

## Verification

- Unit coverage proves creation, correction, scope selection, provider bounds, social isolation,
  suggestion approval, reversible dismissal, forgetting, and restart persistence.
- Real Electron coverage creates and corrects a Maker-only memory, finds it through whole-house
  search, reopens it on Home, verifies 1080-by-720 containment, and confirms two-step forgetting.
- A private copy of the existing Hearth database migrated from schema 20 to 21 with an automatic
  backup and produced only two transparent suggestions from session metadata.
- The installed Hearth database, running application, and PersonalOS source remained untouched.

## Principle

The house may notice, but it does not presume. Memory becomes influence only after the user can see,
understand, and approve it.
