# Current status

This is the current engineering snapshot for Hearth 0.47.2. It complements the historical
milestones, which stop at 0.39.0, and records the audit performed on 2026-08-05.

## What is already working

Hearth is a functional Windows x64 prototype rather than a static interface concept.

- Home, Study, Workshop, Living Room, Library, Studio, Archive, and the paired Companion surface
  share one local source of truth.
- Workshop owns a real ConPTY terminal and a separate managed Claude Code ACP session.
- Managed Maker sessions are project-scoped, resumable, interruptible, permission-aware, and able to
  render plans, thoughts, tool activity, diffs, subagents, modes, effort, and token usage.
- Critic uses an independent read-only Codex ACP route with a visible Claude fallback.
- Living Room supports bounded one-resident conversations, roundtables, and pressure tests without
  merging private resident histories.
- Project review and edits remain contained, explicit, recoverable, and stale-write protected.
- Library, Studio, whole-house search, Archive, Return Packs, and House Memory have canonical,
  durable records rather than duplicated room-local copies.
- Companion is deliberately bounded to orientation, conversation, capture, reports, and reversible
  decisions over loopback or private Tailscale transport.

## What changed after the milestone trail

The numbered milestone records currently end with 0.39.0. The implementation continued through
0.47.2:

| Release window | Material change |
| --- | --- |
| 0.40.x | Larger project handoffs were bounded for Windows process limits and resident context budgets. |
| 0.41.0 | Critic moved to an independent Codex ACP route. |
| 0.42.x | Maker gained managed, resumable, project-scoped Claude Code sessions. |
| 0.43.x | The full Claude workstream became visible and Maker conversation history became project-scoped. |
| 0.44–0.46 | Workshop was unified into a project-bound workbench and visually rebuilt around the Claude Code flow. |
| 0.47.x | Manual, Auto, and Planning controls, effort selection, context usage, terminal-like streaming, and active-turn interruption were completed and repaired. |
| 0.47.2 current | Living Room conversations, pressure tests, handoffs, and managed Workshop interruption are integrated. |

These are implementation facts, not retroactively invented milestones. Future completed work should
resume explicit milestone records or maintain a changelog so the public history does not drift again.

## Audit findings

### Priority zero: dependency advisories

The production dependency audit changed after the 2026-08-03 public-documentation pass. On
2026-08-05 it reports:

- `fast-uri` 3.1.4: high-severity host-confusion advisory
  [GHSA-7p8r-x3mc-p8w7](https://github.com/advisories/GHSA-7p8r-x3mc-p8w7), reached through the
  Claude/MCP validation stack;
- `hono` 4.12.33: moderate-severity CORS-header ReDoS advisory
  [GHSA-8j4g-w8fx-2239](https://github.com/advisories/GHSA-8j4g-w8fx-2239), reached through the
  Model Context Protocol SDK; and
- several `brace-expansion` advisories in build tooling, including
  [GHSA-rgw5-rvv9-x895](https://github.com/advisories/GHSA-rgw5-rvv9-x895).

`npm audit fix --dry-run` reports non-breaking transitive updates for all three families. Apply the
smallest lockfile repair first, then run the full unit, Electron, packaged, ACP, Companion-network,
and installer smoke gates before new feature work.

### Priority zero: no public CI gate

The public repository documents a strong local verification gate but does not currently contain a
GitHub Actions workflow. A clean local run is useful evidence; a public project should also prove
type checking, unit tests, build output, dependency audit policy, and at least a Windows Electron
smoke path on every pull request.

### Provider identity can overstate certainty

Several renderer and provider-status paths use fixed **Claude Opus 5** and **Claude Fable 5** labels.
That matches the intended household configuration, but it is not always evidence of the model the
live ACP session actually selected. When the provider reports a model, Hearth should display it.
When it does not, Hearth should say **configured Opus** or **model not reported**, not present a
hard-coded label as live truth.

### Turn timeout is absolute rather than activity-aware

Managed Maker currently has a fifteen-minute turn timeout. Tool progress does not renew an idle
deadline, and the interface does not distinguish a quiet but healthy model from a stalled adapter,
dead child process, lost provider connection, or long-running tool. This can terminate legitimate
long work and gives the user little help when the provider is actually stuck.

### Context visibility is aggregate

Workshop accurately exposes reported token totals and context use, but the counter cannot explain
what is occupying the window. Hearth should distinguish provider-reported totals from local
estimates and show the bounded material it supplied: current direction, recent conversation,
project evidence, tool results, plans, and approved memory. It must not claim access to hidden
provider prompt construction that ACP does not expose.

### Dependency drift is modest but relevant

The direct ACP adapters have newer releases available (`claude-agent-acp` 0.65.0 and `codex-acp`
1.1.9 at audit time). Because the Claude adapter is pre-1.0 and the managed Workshop depends on
session/update details, adapter upgrades should be isolated and verified rather than swept into an
unrelated feature change.

## Current quality signal

- The tracked worktree was clean at the start of the audit.
- The complete `npm run verify` gate passed on 2026-08-05: type checking, 103 unit tests, the
  production build, and all 13 serial Electron scenarios.
- The Electron run exercised continuity, containment, real ConPTY behavior, handoffs, Living Room,
  project-scoped conversations, reload/relaunch, and responsive layouts.
- Runtime-provider behavior still needs an explicit packaged smoke whenever ACP dependencies,
  provider health, interruption, context, or permissions change.

The implementation plan for these findings and the selected Buzz/Hermes ideas is in
[roadmap.md](roadmap.md).
