# Current status

This is the current engineering snapshot for Hearth 0.49.1. It records the Phase 1 turn-health and
Provider Doctor work completed and live-packaged on Windows on 2026-08-11.

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
| 0.48.0 | Dependency trust baseline, isolated runtime upgrades, Windows CI, and truthful provider identity. |
| 0.49.0 | Activity-aware managed turns, explicit recovery fate, per-turn usage, and Provider Doctor. |
| 0.49.1 current | Long-tool health renewal, truthful adapter-loss state, permission cleanup, and a repeatable packaged health drill. |

These are implementation facts, not retroactively invented milestones. Future completed work should
resume explicit milestone records or maintain a changelog so the public history does not drift again.

## Phase 1 outcome

### Managed turn health

- Managed Maker now uses a renewable ten-minute idle deadline and a separate two-hour safety
  ceiling. Provider events, tool updates, mode/config replies, and permission decisions renew health.
- Workshop distinguishes working, waiting for you, quiet-but-connected, stalled, interrupted,
  failed, and completed states from runtime-owned evidence.
- Every bounded failure records a class, plain-language fate, and whether resending is plausibly
  safe. Hearth never auto-replays a turn; mutating activity produces a visible caution.
- Relaunch cleanup clears pending permissions and marks an orphaned turn as interrupted with an
  explicit no-replay fate.
- Known pending or in-progress tools keep renewing the idle deadline while the separate absolute
  ceiling remains intact. Finished, interrupted, and failed turns clear stale permission and
  deadline indicators.
- Adapter loss now reaps the surviving child, reports the process as stopped, and records
  connection loss without replaying the direction.
- The final 0.49.0 audit also advanced the dev-only `js-yaml` lock entry to 4.3.1 after a new
  quadratic-CPU advisory appeared; production and complete dependency audits are clean.
- The 0.49.1 release gate advanced the dev-only `nanoid` lock entry to 3.3.18 after a new
  zero-size custom-generator advisory appeared; both audits remain clean.

### Usage and recovery truth

- Managed turns persist their reported model, input/output/cache counts, context values, estimated
  prompt characters, and reporting time separately from the session context meter.
- Transcript-only usage is shown as a turn delta only when Hearth has a prior baseline; otherwise it
  stays unknown rather than presenting a session total as one turn.
- “Start fresh session” retires the selected project's continuation pointer without deleting its
  visible history or altering a separate terminal record.

### Provider Doctor

- Workshop exposes read-only Claude and Codex checks for adapter version/discovery, executable
  discovery, auth confidence, handshake, child state, active turns, known sessions, last success,
  and last bounded error.
- Setup guidance is visible when something is missing or unverified. Hearth does not install,
  authenticate, or replay work from the diagnostic panel.

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

## Release evidence

The 0.49.1 unpacked Windows app passed a live Claude/Codex baseline and a repeatable health drill.
A real Claude tool remained healthy beyond the compressed ten-second test idle threshold, exposed
quiet, permission-wait, and completed states, and reported Claude Opus 5 usage. The drill then killed
the exact Claude ACP adapter descendant and verified a stopped process, `connection_lost` fate, and
no automatic replay. A final close/relaunch with a pending write permission verified that the turn
became interrupted, the permission queue was empty, and the unapproved file was never created.

This proves the state transitions and cleanup path under compressed test timings. The production
two-hour absolute ceiling is intentionally not waited out in automation.

## Next engineering findings

### Context visibility is aggregate

Workshop accurately exposes reported token totals and context use, but the counter cannot explain
what is occupying the window. Hearth should distinguish provider-reported totals from local
estimates and show the bounded material it supplied: current direction, recent conversation,
project evidence, tool results, plans, and approved memory. It must not claim access to hidden
provider prompt construction that ACP does not expose.

## Current quality signal

- Type checking, 109 unit tests across 15 files, the production build, and all 13 serial Electron
  scenarios pass for 0.49.1. The packaged live baseline and health drill also pass.
- The 0.49.1 Electron run exercised continuity, containment, real ConPTY behavior, handoffs, Living Room,
  project-scoped conversations, reload/relaunch, and responsive layouts.
- The current rebuilt package passed both the local ConPTY smoke and the optional live Claude/Codex
  ACP smoke. Those remain required whenever provider, interruption, context, or permissions change.

The implementation plan for these findings and the selected Buzz/Hermes ideas is in
[roadmap.md](roadmap.md).
