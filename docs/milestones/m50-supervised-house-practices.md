# Milestone 50: Supervised House Practices

Hearth 0.52.0 completes Phase 4 by turning a small set of repeated lifecycle patterns into visible,
reviewable guidance rather than hidden automation.

## Delivered

- Migration-safe practice records with scope, proposed effect, evidence count, sanitized provenance,
  and last-observed time.
- Allowlisted detection for usual Workshop session type and repeated project returns.
- Evidence refresh while waiting, with accepted and dismissed decisions frozen against silent
  rewrites.
- Full-width House Memory review cards with effect, evidence, provenance, and explicit guidance-only
  labeling.
- Edit-before-approval, adopt, dismiss, restore, correct, and forget controls.
- Project-scope preservation when editing an older practice from a different current project.
- Approved-practice framing for private resident turns and Living Room discussions with an explicit
  ban on execution, file, provider, mode, installation, verification, and permission authority.

## Verification

- TypeScript contract check and all 112 unit tests pass.
- All 14 deterministic Electron scenarios pass on Windows.
- The new real-app scenario creates lifecycle evidence, reviews provenance, edits, dismisses,
  restores, adopts, and forgets a practice.
- Visual and containment checks pass at 1440×900 and 1080×720.
- Complete and production dependency audits remain clean.

## Boundary

No conversation, source file, command, terminal output, capture, or clipboard content is mined.
Hearth does not create skills, execute a practice, or convert a remembered preference into
permission.
