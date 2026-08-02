# Installed-build hardening

## Proven

- Hearth no longer treats its installed executable directory as a project merely because it is the process working directory.
- A stale remembered install path is repaired to the real Hearth repository when that repository is discoverable.
- Bootstrap waits for project discovery, so Home, Study, and Workshop agree on the selected project from the first rendered frame.
- New Workshop processes inherit the repaired project root.
- Assigning a Claude session ID does not, by itself, make a conversation resumable.
- Hearth only offers resume after the user or Maker submits real input to Claude Code.
- Claude's missing-conversation response invalidates the stored ID and presents a clear fresh-start action.
- Existing databases migrate safely; older unverified Claude IDs are discarded rather than offered for resume.
- The separate Windows title/menu band is removed.
- Minimize, maximize, close, snap, and native accessibility behavior remain owned by Windows through Electron's title-bar overlay.
- Standard, compact, and terminal-focus layouts preserve their bounds with the integrated window chrome.
- The packaged smoke test launches without a development project-root override and proves both repo selection and the PTY working directory.

## Verification

- TypeScript typecheck
- Eight unit tests, including installed-directory rejection and Claude resumability rules
- Six real-Electron end-to-end journeys
- Packaged Windows launch, project discovery, and ConPTY smoke test
- Visual review at 1440 × 900, 1080 × 720, and terminal focus mode

## Current boundary

Hearth knows that a prompt was submitted; it does not parse Claude's private conversation storage. If Claude later rejects a resume for any reason, Hearth immediately stops claiming that conversation can be resumed and offers a fresh session.
