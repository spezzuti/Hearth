# ADR 0022: Explicit tray lifecycle

Status: Superseded by [ADR 0023](0023-default-tray-lifecycle.md).

## Context

Native notifications are useful while Hearth is minimized, but a close button still ends the
process, live terminal, private Companion service, and notification delivery. Some work sessions
benefit from keeping Hearth nearby in the Windows tray.

Silently changing the close button into a background action would violate the product's emphasis on
truthful process state. It could leave terminals and private access running after the user believes
they exited.

## Decision

Tray residency is a persisted, explicit, off-by-default preference.

When disabled, Hearth retains standard Windows behavior: closing the main window performs the full
ordered shutdown. When enabled, a user-initiated window close is prevented and the existing window
is hidden. **Hide now** offers the same behavior without overloading the close button.

The tray owns only three visible concepts: restore Hearth, bounded Workshop attention state, and
full quit. Tray click restores the existing BrowserWindow. It never creates a second working home.

**Quit Hearth** calls the normal application quit path. The quit flag is set before windows close,
so close-to-tray interception cannot block shutdown. The tray icon is destroyed before Companion,
private transport, terminals, and the core are stopped.

Disabling tray mode while hidden restores the window before destroying the icon, preventing an
invisible process with no user access point.

## Consequences

- Users can intentionally keep live work and private Companion access available in the background.
- Default close behavior remains unsurprising.
- The tray makes current Workshop attention visible without exposing terminal output.
- Startup with Windows, machine-restart recovery, and unattended background service behavior remain
  outside this decision.
