# Security policy

## Supported version

Hearth is pre-1.0. Security fixes are applied to the newest published Windows release candidate.

## Reporting a vulnerability

Please do not open a public issue for a suspected vulnerability. Use GitHub's private vulnerability
reporting for `spezzuti/Hearth` when available. If that surface is unavailable, contact the repository
owner privately before sharing reproduction details.

Useful reports include the affected Hearth version, the Windows version, the trust boundary involved,
and a minimal reproduction that does not contain real credentials, project source, prompts, terminal
scrollback, or personal paths.

## Security boundaries

Hearth runs Claude Code, Codex, terminals, and project tools with the permissions of the signed-in
Windows user. It is not a security sandbox for those tools. The renderer is sandboxed away from Node,
and project writes, remote Companion access, link retrieval, and resident context each have narrower
boundaries documented in [Security notes](docs/security-notes.md).
