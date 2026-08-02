# Milestone 23: Loopback Companion foundation

Hearth 0.20 introduces the real mobile-shaped Companion surface while keeping it inaccessible from
other devices until secure transport is separately approved and built.

## Delivered

- A Home control replacing the low-value activity feed with **Companion access**.
- Explicit, session-only enablement; off on every Hearth launch.
- Strict `127.0.0.1` binding on a stable local port.
- Ten-minute six-digit pairing codes.
- Pairing throttled after five failures.
- Process-memory session tokens in HTTP-only, same-site-strict cookies.
- **New code** revokes all prior paired sessions.
- A responsive 390-pixel mobile interface for:
  - current status and Return Pack;
  - ambient Workshop attention state;
  - quick idea or note capture;
  - recent closed reports and captures;
  - natural Companion conversation.
- No terminal, project-file, execution, editing, ownership, or project-switch route.
- Bounded request bodies, headers, request timeouts, and a restrictive content-security policy.
- Desktop, server-unit, paired-browser, capture, revocation, unavailable-route, and shutdown coverage.

## Current boundary

This build is not remotely reachable. The local address works only on the Windows PC running
Hearth. It does not bind the LAN, automate firewall rules, start a public tunnel, or configure a
third-party network. Pairing and sessions disappear when Hearth closes.

## Next

Add an optional private remote transport detector and guided setup around the loopback service,
favoring authenticated tailnet HTTPS access. Keep public exposure unavailable, show the exact remote
address and transport owner, and preserve the same narrow Companion capability set.
