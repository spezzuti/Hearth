# Milestone 57 — furnishing and Companion complete

Hearth 0.58.0 closes Phase 4.5 as a release-quality visual checkpoint. Every room now reads as a
distinct part of one working home, and Companion has a final expressive identity rather than a
code-native placeholder.

## Companion outcome

- One stable charcoal, walnut, brass, and amber resident appears across idle, listening, thinking,
  and reply states.
- Home uses the complete free-standing character, including articulated lamp, hands, controls, and
  recessed indoor treads.
- Conversation and household cards use a consistent face-forward crop over a softly furnished Home
  background so Companion carries equal visual weight with Maker, Librarian, and Critic.
- State changes reflect real interaction state and retain the existing reduced-motion boundary.
- A validated v2 frame atlas supplies nine standard animation states and sixteen look directions.
  Click-to-chat keeps the full resident visible, and exact half-turns use the stable lower arc.

## Publication outcome

- Workshop, Living Room, Library, Studio, and mobile screenshots now represent the furnished
  0.58.0 interface.
- The Workshop hero uses the managed workstream rather than a raw terminal fixture, avoiding local
  user paths while showing plans, tools, agents, token use, modes, effort, and Maker together.

## Verification

- Type checking and all 113 unit tests pass.
- All 15 serial Electron workflows pass in the production build.
- The packaged x64 app passes project discovery, tray close/relaunch, and real ConPTY input/output.
- The suite covers 1440×900, 1080×720, 1040×700, narrow mobile, resident conversations, project
  isolation, links, copy/paste, wrapping, ConPTY persistence, Archive recovery, and reduced motion.
- Final Home and Living Room screenshots were inspected for Companion scale, portrait consistency,
  clipping, and horizontal containment.
