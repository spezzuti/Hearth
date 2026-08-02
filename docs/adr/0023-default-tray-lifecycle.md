# ADR 0023: Default Windows tray lifecycle

## Context

Hearth is intended to be a working home rather than a conventional document window. Its terminal,
residents, notification delivery, and explicitly enabled Companion access are useful when the main
window is out of the way. A tray preference, a separate **Hide now** action, and an on/off switch
made that ordinary Windows lifecycle feel like a feature the user had to manage.

The application must still make real shutdown dependable. Hiding the window cannot become an
invisible or ambiguous quit path.

## Decision

Hearth creates one tray icon whenever the desktop application starts. Clicking the window's **X**
hides the existing BrowserWindow. Clicking the tray icon restores and focuses that same window.
Right-clicking the tray exposes **Quit Hearth**, which invokes the existing ordered application
shutdown.

Close interception applies only while the application is not already quitting. Once quit begins,
Hearth destroys the tray, removes private Companion sharing, stops Companion, closes terminal and
core processes, and allows the BrowserWindow to close.

There is no renderer tray API, saved tray preference, tray switch, or separate hide button. The
window and tray share the packaged Hearth ICO so Windows does not fall back to Electron's identity.

The persisted Windows-alert switches remain available, but are collapsed behind **Alerts** beside
the Companion access actions. Their delivery and privacy behavior is unchanged.

## Consequences

- Closing Hearth's window preserves live work and background attention without adding Home UI.
- Full exit is explicit and consistently available from the tray.
- There is one live window and one tray icon, not a second background application surface.
- Startup with Windows, signed-out operation, and machine-restart recovery remain outside this
  decision.
- Users upgrading from 0.24.0 may retain an unused `tray-mode` preference row; it has no behavior
  and is safe to leave in the local database.
