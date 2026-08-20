# Changelog

Hearth follows semantic versioning during its pre-1.0 period. Until automatic updating is designed,
each tagged Windows release is a deliberate manual install over the previous version.

## 0.60.2 — 2026-08-20

### Added

- Stable directional Companion gaze frames and restrained cursor-aware motion.
- Home recovery controls for an immediate SQLite snapshot and direct access to Hearth's private data
  folder.
- A renderer recovery boundary so a room-level render failure offers a safe reload instead of a
  blank window.
- A signed-tag GitHub release gate and an explicit security-reporting policy.

### Changed

- Reconciled the public source tree with the tested 0.60.2 Windows build.
- Pinned link-enrichment connections to the public DNS address Hearth validated.
- Expanded reserved-network rejection to cover Tailscale/CGNAT, multicast, documentation, and
  benchmarking ranges.
- Removed private backup filesystem paths from renderer responses.

### Verification

- TypeScript contract check.
- 124 unit tests across 17 files.
- 16 serial Electron continuity scenarios.
- Production and complete locked dependency audits.
- Unpacked ConPTY smoke, live-provider smoke, native Claude Code mode/steering smoke, and the
  destructive isolated health drill passed on Windows.
- The NSIS installer built successfully. Authenticode signing and clean install/upgrade checks remain
  public-release gates rather than claimed results.
