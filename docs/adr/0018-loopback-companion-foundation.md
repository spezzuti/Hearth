# ADR 0018: Loopback Companion foundation

## Context

Hearth should eventually be useful away from the primary Windows desktop, but exposing the desktop
renderer, terminal, project files, or broad core IPC over a network would turn a focused companion
into a remote-control product with a much larger security boundary.

Secure transport and product capability are separate problems. Hearth can prove the smaller product
surface locally before authorizing any LAN or internet listener.

## Decision

The Electron main process owns an opt-in HTTP Companion service because it already brokers the
allowlisted local-core requests. The service is off on every launch and binds only to
`127.0.0.1:47831`. It never binds a LAN interface.

Pairing uses a random six-digit code that expires after ten minutes. Five failures pause pairing
until the desktop generates a new code. A successful pair receives a random, process-memory session
token in an HTTP-only, same-site-strict cookie. Generating a new code rotates the token and revokes
all paired sessions. Closing Hearth destroys the service and every credential.

The mobile surface has only these capabilities:

- current project name, truthful Return Pack, and ambient Workshop observation;
- recent non-archived captures and closed handoff reports;
- idea or note capture;
- Companion conversation.

The server does not define routes for terminal output or input, project paths or files, edits,
apply/undo, project selection, Maker/Critic context, handoff activation, or provider selection. All
request bodies, headers, and timeouts are bounded. Response policy disables caching, framing,
referrers, external scripts, and cross-origin assets.

The first release is deliberately local-only. Private remote transport—such as an explicitly
configured tailnet HTTPS proxy to the loopback listener—remains a later, separate permission and
integration milestone. Public tunneling is outside this boundary.

## Consequences

- The phone interface and capability model can be tested without opening a network port.
- Missing remote transport is visible in both desktop copy and service status.
- Pairing sessions do not survive app restart and cannot become forgotten long-lived credentials.
- The main process gains a small HTTP parser and router that requires focused security tests.
- A later remote transport can forward to the same loopback service without expanding its product
  capabilities.
