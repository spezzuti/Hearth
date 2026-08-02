# Milestone 25: Live Companion continuity

Hearth 0.21.1 closes the two remaining prototype seams in the private phone surface: Companion now
uses real bounded household reasoning, and writes from the phone appear promptly in the open desktop.

## Delivered

- Companion joins the Claude Code reasoning household on Opus.
- A dedicated Companion role prompt preserves casual conversation, dry warmth, bounded home context,
  and truthful limits without turning every exchange into workflow guidance.
- Casual social turns deliberately withhold project status and old conversation subjects.
- Non-casual turns receive a small home snapshot: current project, objective, Return Pack, ambient
  Workshop truth, and five recent capture labels.
- The provider remains tool-free, non-persistent, budget-bounded, and unable to act on the desktop.
- Both phone and desktop Companion surfaces show the actual provider or **Local fallback**.
- Successful phone captures emit a narrow desktop synchronization event.
- Completed phone Companion turns emit the same event, keeping both conversations aligned.
- Desktop Home refreshes from authoritative core state without a manual reload or room change.
- A quiet desktop toast acknowledges an arriving Companion capture.
- Automated app coverage proves phone conversation and capture continuity into the open desktop.
- A live provider check confirms Companion routes to Opus and returns a non-template conversational
  answer.

## Existing data

Phone captures made before this correction were already safely persisted. They become visible as
soon as the refreshed desktop loads; no migration or recovery is required.

## Boundary

Synchronization carries only a change notification into the trusted renderer. The renderer reloads
the existing bounded bootstrap contract from the local core. No database rows, network payloads,
terminal data, or project files are sent through the event.
