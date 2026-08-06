# Contributing to Hearth

Hearth is an early Windows-first project. Issues, careful bug reports, design critiques, and focused
pull requests are welcome.

## Development setup

Requirements:

- Windows 10 or 11, x64
- Node.js 24.x and npm 11.x
- Git for Windows

```powershell
git clone https://github.com/spezzuti/Hearth.git
cd Hearth
npm ci
npm run dev
```

Use local-provider mode when model behavior is irrelevant to the change:

```powershell
$env:HEARTH_AGENT_PROVIDER = "local"
npm run dev
```

Development data is isolated from the installed application under `%APPDATA%\Hearth Development`.
Tests use their own fixture roots and databases.

## Before opening a pull request

Run the checks proportionate to the change:

```powershell
npm run typecheck
npm test
npm run test:e2e
```

`npm run verify` runs the complete gate. UI changes should be checked at 1440 × 900 and Hearth's
compact desktop size. Terminal changes must also cover long unbroken text, copy/paste, resize,
reflow, focus, and a live ConPTY process.

## Design constraints

Changes should preserve these rules:

- The renderer never receives a raw filesystem, process, SQLite, or unrestricted network API.
- Conversation does not imply execution. A resident must not claim an action without the surface
  and result that prove it.
- Private resident histories do not become shared-room context automatically.
- Terminal output is untrusted, bounded, redacted when handed off, and not persisted as memory.
- Project review is read-only unless the user deliberately enters the one-file edit flow.
- Destructive actions require an explicit target, warning, and confirmation.
- Fallback providers are labeled honestly.
- New UI should remain comfortable rather than compressing text to avoid scrolling.

Read [docs/current-status.md](docs/current-status.md), [docs/roadmap.md](docs/roadmap.md),
[docs/architecture.md](docs/architecture.md), and [docs/security-notes.md](docs/security-notes.md)
before changing a capability boundary or beginning a roadmap milestone.

## Pull requests

Keep pull requests focused and explain:

- the user problem;
- the root cause or design pressure;
- the chosen behavior and tradeoffs;
- the verification performed;
- any persistence, provider, terminal, or security impact.

Do not commit generated application data, provider credentials, `.env` files, build output, Electron
profiles, test artifacts, or packaged installers.

## Reporting bugs

Include the Hearth version, Windows version, room/surface, exact reproduction steps, expected and
actual behavior, and whether the issue occurs in local-provider mode. Remove project source,
terminal output, tokens, and personal paths from screenshots and logs.

Security issues should follow [SECURITY.md](SECURITY.md), not a public bug report.
