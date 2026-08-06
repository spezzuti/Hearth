# Current status

This is the current engineering snapshot for Hearth 0.48.0. It records the Phase 0 trust-baseline
work completed and locally verified on 2026-08-06.

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

The earlier numbered milestone trail paused at 0.39.0. The implementation continued through 0.47.2,
and explicit milestone records resume with 0.48.0:

| Release window | Material change |
| --- | --- |
| 0.40.x | Larger project handoffs were bounded for Windows process limits and resident context budgets. |
| 0.41.0 | Critic moved to an independent Codex ACP route. |
| 0.42.x | Maker gained managed, resumable, project-scoped Claude Code sessions. |
| 0.43.x | The full Claude workstream became visible and Maker conversation history became project-scoped. |
| 0.44–0.46 | Workshop was unified into a project-bound workbench and visually rebuilt around the Claude Code flow. |
| 0.47.x | Manual, Auto, and Planning controls, effort selection, context usage, terminal-like streaming, and active-turn interruption were completed and repaired. |
| 0.47.2 | Living Room conversations, pressure tests, handoffs, and managed Workshop interruption are integrated. |
| 0.48.0 current | Dependency trust baseline, isolated runtime upgrades, Windows CI, and truthful provider identity. |

These are implementation facts, not retroactively invented milestones. Future completed work should
resume explicit milestone records or maintain a changelog so the public history does not drift again.

## Phase 0 outcome

### Dependency and runtime baseline

- `fast-uri`, `hono`, and every affected `brace-expansion` branch were repaired with transitive
  lockfile updates. Both `npm audit` and `npm audit --omit=dev` report zero known vulnerabilities.
- Claude ACP moved to 0.65.0, Codex ACP to 1.1.10, `node-pty` to 1.2.0-beta.15, and Electron to
  43.3.0. Each runtime family was upgraded and verified in a separate commit.
- The rebuilt Windows package passed real ConPTY startup/input/shutdown behavior. Its optional live
  provider smoke also proved Codex routing, Claude workstream details, plan/manual switching, token
  usage, and cancel-then-replace interruption.

### Public verification

`.github/workflows/windows-ci.yml` now runs locked installation, production audit, type checking,
unit tests, production build, and the deterministic 13-scenario Electron suite on Windows. Failed
Electron traces are retained for seven days. The workflow is committed locally; its first public
green run remains external confirmation after push, so no status badge is claimed yet.

### Provider identity truth

Resident status now distinguishes a configured model alias, a model actually reported by Claude,
and an unavailable or unreported model. Managed Maker reads the ACP model selector and the bounded
Claude transcript; the live packaged smoke reported **Claude Opus 5**. Before that evidence exists,
the UI says **Claude configured Opus**. Codex is identified as the active provider without inventing
an underlying model the adapter did not disclose.

## Next engineering findings

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

## Current quality signal

- The complete `npm run verify` gate passed on 2026-08-06: type checking, 106 unit tests across 15
  files, the production build, and all 13 serial Electron scenarios.
- The Electron run exercised continuity, containment, real ConPTY behavior, handoffs, Living Room,
  project-scoped conversations, reload/relaunch, and responsive layouts.
- The current rebuilt package passed both the local ConPTY smoke and the optional live Claude/Codex
  ACP smoke. Those remain required whenever provider, interruption, context, or permissions change.

The implementation plan for these findings and the selected Buzz/Hermes ideas is in
[roadmap.md](roadmap.md).
