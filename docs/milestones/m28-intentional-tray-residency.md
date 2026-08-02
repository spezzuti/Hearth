# Milestone 28: Intentional tray residency

This opt-in interaction was simplified in Milestone 29: tray residency is now the default desktop
lifecycle, and the Home switch and **Hide now** action were removed.

Hearth 0.24.0 can remain available in the Windows notification area when the user deliberately wants
the working home and its live processes to stay nearby.

## Delivered

- A persisted **Keep Hearth in the tray** switch on Home.
- Tray mode remains off by default.
- A separate **Hide now** action for deliberate backgrounding.
- Window close hides Hearth only after tray mode has been enabled.
- A Hearth tray icon generated from the existing application identity.
- Single-click restoration of the existing window.
- A native tray menu with:
  - **Open Hearth**;
  - a read-only **Workshop is quiet** or **Workshop needs input** line;
  - **Quit Hearth**.
- Workshop tooltip state without terminal output or conversation content.
- Turning tray mode off first restores a hidden window, then removes the tray icon.
- Application activation restores a hidden Hearth instead of creating a second window.
- The existing full shutdown path remains responsible for stopping private sharing, Companion,
  terminals, and the local core.
- Packaged smoke coverage proves the shipped tray resource can be created, hidden, restored, and
  removed before exercising the real ConPTY terminal.

## Lifecycle truth

| Action | Tray off | Tray on |
| --- | --- | --- |
| Minimize | Minimized window | Minimized window |
| Hide now | Unavailable | Hidden with tray access |
| Window close | Full exit | Hidden with tray access |
| Open Hearth | N/A | Restore and focus existing window |
| Quit Hearth | Full exit | Full exit |

Tray mode does not enable startup with Windows, run Hearth after a user signs out, or preserve work
through a machine restart. Those are separate product decisions.

## Boundary

The tray contains no command execution, project switching, terminal ownership, agent prompts,
captured text, or file data. Its only actions are restore and full quit. Workshop state is reduced
to one generic quiet/needs-input label.
