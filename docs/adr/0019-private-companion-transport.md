# ADR 0019: Private Companion transport

## Context

The loopback Companion proved the phone-shaped product boundary without opening Hearth to a network.
The next requirement is useful access away from the desk without creating a public endpoint, binding
Hearth to the LAN, or adding terminal and file capabilities to the mobile surface.

The Windows machine already owns local network identity and policy through Tailscale. Tailscale Serve
can terminate private HTTPS for allowed tailnet devices and proxy only to a localhost service.
Tailscale Funnel is a separate public-internet feature and is outside Hearth's boundary.

## Decision

Hearth detects the installed Tailscale client and its signed-in state with read-only CLI status
commands. It does not sign in, modify tailnet policy, enable Funnel, or share anything during
detection.

After local Companion access is running, the user can explicitly choose **Share privately**. Hearth
then asks Tailscale Serve to proxy private HTTPS port `8443` to
`http://127.0.0.1:47831`. The dedicated port avoids taking over the normal HTTPS root and preserves
unrelated Serve configuration.

Before any change, Hearth inspects the Serve status. It proceeds only when port `8443` is unused or
already contains exactly one root HTTPS proxy to Hearth's loopback address. Any other listener,
handler, or proxy is reported as a conflict and left untouched. Disabling removes only the exact
`8443` Serve route; Hearth never uses the global Serve reset command.

Routes created by the running Hearth process are removed during a normal shutdown. A route left by a
crash is harmless while the loopback service is off, remains visible on Home, and can be explicitly
removed. Routes that predate the process are not silently claimed for shutdown cleanup.

Tailnet access and HTTPS do not replace Hearth pairing. Remote browsers still need the temporary
six-digit code and receive the same process-memory session. Cookies issued through the HTTPS proxy
also carry the Secure attribute.

## Consequences

- The PC remains the only process listening for Companion; Tailscale owns private transport.
- Another allowed tailnet device can reach Companion while the PC is awake, Tailscale is connected,
  Hearth is open, Companion is on, and private sharing is active.
- Tailscale access policy is an outer gate and Hearth pairing is a second application gate.
- Existing services on other Serve ports or paths are preserved.
- No public URL, Funnel command, firewall rule, LAN listener, terminal route, or project-file route is
  introduced.
- Users without Tailscale retain the complete local Companion experience.

## References

- [Tailscale Serve](https://tailscale.com/docs/features/tailscale-serve)
- [Tailscale Serve CLI](https://tailscale.com/docs/reference/tailscale-cli/serve)
