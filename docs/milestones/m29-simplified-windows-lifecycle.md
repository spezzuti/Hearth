# Milestone 29: Simplified Windows lifecycle

Hearth 0.24.1 removes the controls that made ordinary background residency feel over-engineered.

## Delivered

- The main window's **X** always hides the existing Hearth window to the Windows tray.
- A single tray click restores and focuses that same window.
- The tray's **Quit Hearth** command remains the real, ordered application shutdown.
- The saved tray preference, Home switch, renderer tray bridge, and **Hide now** button are gone.
- The tray retains its bounded **Workshop is quiet** or **Workshop needs input** status.
- Windows-alert switches now start collapsed behind **Alerts** in the Companion access action row.
- Alert preferences still persist individually and retain their minimized-only delivery rules.
- The Hearth ICO is explicitly assigned to both BrowserWindow and tray, preventing Electron's
  fallback icon from appearing in the taskbar.
- Electron and packaged smoke coverage both prove that close hides without destroying the live
  BrowserWindow and that it can be restored.

## Lifecycle truth

| Action | Result |
| --- | --- |
| Minimize | Normal minimized window |
| Window **X** | Existing window hidden; Hearth remains in tray |
| Tray click | Existing window restored and focused |
| Tray **Quit Hearth** | Full ordered exit |
| Windows/application shutdown | Full ordered exit |

Hearth does not start automatically with Windows, run after sign-out, or recover live processes
after a machine restart.

## Boundary

The tray still contains no command execution, project switching, terminal ownership, resident
prompts, captured text, or file data. Its only actions are restore and full quit; Workshop state is
reduced to a generic quiet/needs-input label.
