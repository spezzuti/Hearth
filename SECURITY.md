# Security policy

## Reporting a vulnerability

Please use GitHub's private vulnerability reporting for this repository. Do not open a public issue
for a vulnerability that could expose project files, credentials, terminal input, local application
data, or remote Companion access.

Include:

- the affected Hearth version and Windows version;
- the capability boundary involved;
- minimal reproduction steps using non-sensitive fixture data;
- expected and observed behavior;
- impact and any known mitigation.

Do not include real credentials, private source code, terminal history, or a user's Hearth database.

## Supported version

Hearth is pre-1.0. Security fixes target the current `main` branch and latest published source
version. Older development snapshots are not supported.

## Security model

Hearth is a local desktop application that can interact with source repositories, terminals, model
providers, public links, and an optional private mobile surface. Its primary defenses are process
separation, narrow validated IPC, path containment, bounded data movement, explicit ownership and
approval, and honest provider/capability labels.

The detailed model is maintained in [docs/security-notes.md](docs/security-notes.md). Architecture is
documented in [docs/architecture.md](docs/architecture.md).

## Out of scope

- vulnerabilities in Claude Code, Codex, Electron, Node.js, Tailscale, or another upstream project
  that do not arise from Hearth's integration;
- social engineering that requires the user to deliberately paste and approve an unsafe command in
  an owned terminal;
- unsupported operating systems or modified builds that remove Hearth's validation boundaries.

Reports about Hearth incorrectly expanding authority, leaking bounded context, crossing a project
root, mishandling credentials, or exposing Companion without valid pairing are in scope.
