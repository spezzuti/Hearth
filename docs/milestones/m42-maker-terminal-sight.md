# Milestone 42: Maker Terminal Sight

Hearth 0.37.0 makes Maker genuinely useful beside a live Workshop session without making chat an
autonomous execution channel.

## Delivered

- Automatic bounded recent-terminal context when Maker has the live terminal seat.
- ANSI cleanup, line and character caps, repeated-blank collapse, delimiter neutralization, and
  common credential redaction before provider use.
- Strict exclusion from persistence, House Memory, conversation history, Return Packs, search,
  execution reports, and every other resident.
- Provider guidance that treats the view as incomplete, unverified, untrusted evidence.
- Natural Workshop language: **I can see the terminal** and
  **Maker can read the recent terminal**.
- The existing explicit proposal and instruction handoff remains the only chat-to-terminal route.

## Verification

- Unit coverage proves bounded cleanup, credential redaction, delimiter safety, prompt inclusion,
  resident isolation, and unchanged authority language.
- Real Electron coverage gives Maker the terminal seat after producing real ConPTY output and
  verifies the visible sight-versus-action boundary.
- The complete Windows continuity suite still covers terminal input, copy/paste, Unicode, links,
  resize, renderer reattachment, session persistence, stop, and full-exit cleanup.

## Principle

Maker should see enough to be a useful collaborator. Seeing the work is not permission to perform it.
