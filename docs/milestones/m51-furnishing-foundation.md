# Milestone 51 — furnishing foundation

Hearth 0.53.0 begins Phase 4.5 with a house-wide visual language and the first fully furnished room.

## Shipped

- Shared material, typography, shadow, focus, selection, and motion tokens.
- A warmer, deeper application shell that preserves the existing layout and native title controls.
- Home-specific plaster light, ambient window glow, an ember system state, a desk-like Return Pack,
  differentiated working panels, and larger household portraits.
- A stable current-room styling hook for later furnishing passes.
- A compact Home layout that favors readable single-column cards over cramped two-column density.
- Visual-language and roadmap documentation that separates the remaining room and Companion work
  from this foundation release.

## Verification

- TypeScript and production renderer builds pass.
- All 14 Electron scenarios pass in an isolated Windows fixture.
- The Home flow remains contained at full desktop size and 1080×720, with an explicit assertion
  against horizontal document or room overflow.
