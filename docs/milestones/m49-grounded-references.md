# Milestone 49: Grounded references

Hearth 0.51.0 turns saved links into calm, reusable source records without turning the house into a
browser or GitHub client.

## Delivered

- Local recognition and canonicalization for ordinary web pages and GitHub repositories, pull
  requests, issues, releases, and commits.
- A persisted migration-safe reference record with retrieval state, canonical URL, repository
  identity, bounded public metadata, and project relationships.
- SSRF-safe HTML enrichment plus separately bounded GitHub public API enrichment.
- One shared reference-card language across Library, Study project connections, Living Room
  context, and Archive detail.
- Stable Librarian source IDs, distinct recommendation evidence, and explicit labels for direct
  evidence, inference, recommendation, and unverified metadata.
- A strict quotation boundary: metadata is never treated as verified page-body text.
- Updated Node 24 GitHub Actions using the current official major releases.

## Verification

- TypeScript contract check passes.
- 112 unit tests across 15 files pass.
- All 13 deterministic Electron continuity scenarios pass on Windows.
- The new end-to-end path verifies canonical GitHub capture, removal of tracking parameters,
  Library rendering, and a connected Study reference at 1440×900 and 1080×720.
- Production build and visual inspection pass.

## Boundary

Librarian remains conversational and advisory. She cannot clone, install, save, dismiss, edit,
verify, or execute an item through chat. Hearth does not retain arbitrary page bodies and does not
claim a quotation is verified when no bounded page-body source exists.
