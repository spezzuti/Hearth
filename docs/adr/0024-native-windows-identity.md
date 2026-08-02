# ADR 0024: Native Windows identity

## Context

Hearth's installed executable and tray contained the correct icon, yet Windows could still show
Electron's icon on the live taskbar button. The packaged application and unpackaged development
process shared `home.hearth.desktop` as their App User Model ID. Windows is allowed to group and
cache taskbar identity by that ID, so running development Electron could contaminate the installed
application's shell presentation.

Default close-to-tray also creates a second native expectation: selecting Hearth again should
restore the hidden working home, not create another core, tray, terminal owner, or Companion server.

## Decision

Installed Hearth owns `home.hearth.desktop`. Unpackaged development and automated Electron runs own
`home.hearth.desktop.development`. The App User Model ID is assigned before application readiness
and before any BrowserWindow exists.

The main BrowserWindow receives:

- the packaged Hearth ICO at construction;
- an explicit `setIcon` call; and
- Windows taskbar application details containing the matching App ID, relaunch icon path, and icon
  index.

The Windows executable is also packaged directly from the ICO rather than relying on SVG
conversion.

Hearth acquires Electron's single-instance lock before startup. A second launch exits before
starting privileged services and emits `second-instance` to the existing process, which restores
and focuses the live BrowserWindow.

Automated and development runs derive Electron's user-data path from their isolated Hearth data
directory. Their lock and shell identity therefore remain separate from installed Hearth.

## Consequences

- Development Electron cannot become the icon source for installed Hearth's taskbar group.
- The taskbar, executable, window, relaunch identity, and tray all point at the same ICO.
- Reopening hidden Hearth behaves like restore, not duplicate launch.
- Only the primary instance starts the core, terminal broker, Companion, remote transport, tray, or
  notifications.
- Existing Windows icon caches may update only after the old process exits and the new build starts;
  Hearth no longer feeds those caches a shared development identity.
