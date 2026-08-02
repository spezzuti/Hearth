# Milestone 24: Private Companion transport

Hearth 0.21 makes the deliberately small Companion reachable from the user's private devices while
keeping both its product capabilities and its network boundary narrow.

## Delivered

- Read-only detection of Tailscale installation, connection state, private DNS name, and Serve state.
- Explicit **Share privately** and **Stop sharing** controls on Home.
- Private HTTPS on a dedicated `8443` Serve port, leaving existing `443` services untouched.
- Exact-target verification before setup or removal.
- Conflict refusal instead of replacing an occupied port or compound Serve configuration.
- Normal-shutdown cleanup only for routes created by the running Hearth process.
- A visible removal control for a stale exact Hearth route after an interrupted process.
- Tailnet HTTPS plus the existing expiring Hearth pairing and revocable session.
- Secure cookies when pairing arrives through the HTTPS proxy.
- No use of Tailscale Funnel, public tunnels, LAN listeners, firewall automation, or broad desktop IPC.
- A refined phone composition with:
  - verified absence of horizontal overflow at 320, 390, and 430 pixels;
  - larger reading text and 44-pixel touch controls;
  - current status, Return point, capture, and Companion in task-priority order;
  - collapsible reports and recent captures;
  - bounded chat presentation with the newest message kept in view;
  - immediate outgoing messages;
  - Enter to send and Shift+Enter for a new line.

## Operational boundary

Private access works only while the Windows PC is awake, Tailscale is connected, Hearth is open,
Companion access is on, and sharing is active. The phone must be an allowed device in the same
tailnet. Pairing remains required. The mobile surface still cannot read terminal output, browse
project files, edit work, run commands, change ownership, switch projects, or activate handoffs.

## Next

Exercise the private address on the physical phone, then continue with mobile decision surfaces and
notification routing without expanding into remote terminal control.
