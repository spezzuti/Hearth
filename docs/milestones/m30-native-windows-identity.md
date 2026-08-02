# Milestone 30: Native Windows identity

Hearth 0.25.0 completes the Windows shell behavior introduced by tray residency.

## Delivered

- Installed Hearth and unpackaged Electron now use separate App User Model IDs.
- The production App ID is assigned before application readiness and window creation.
- The Hearth ICO is explicitly bound to:
  - the packaged executable;
  - BrowserWindow construction;
  - the live window icon;
  - Windows taskbar relaunch details; and
  - the tray.
- A single-instance lock prevents duplicate Hearth processes.
- Launching Hearth while its window is hidden restores and focuses the existing working home.
- A rejected second instance exits before it can start the core, Companion, remote sharing, terminal
  broker, notifications, or another tray icon.
- Development and automated runs use an isolated Electron data directory and development App ID.
- Electron regression coverage proves relaunch restoration.
- Packaged smoke coverage proves the same behavior in the shipped Windows executable before running
  the real ConPTY terminal.

## Windows behavior

| Action | Result |
| --- | --- |
| Close window | Existing Hearth hides to tray |
| Click tray | Existing Hearth restores |
| Launch Hearth again | Existing Hearth restores; second process exits |
| Tray **Quit Hearth** | One ordered shutdown |

No startup-with-Windows behavior was added. Hearth still runs only after the user launches it.
