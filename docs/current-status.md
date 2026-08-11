# Current status

This is the current engineering snapshot for Hearth 0.53.0. It records the first Phase 4.5 furnishing
pass completed and verified on Windows on 2026-08-11.

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
| 0.49.1 | Long-tool health renewal, truthful adapter-loss state, permission cleanup, and a repeatable packaged health drill. |
| 0.50.0 | Persisted per-turn context manifests, provider/local accounting separation, and threshold-aware continuity choices. |
| 0.51.0 | Typed canonical references, bounded public metadata, calm cross-room source cards, and Librarian citation rules. |
| 0.52.0 | Supervised House Practices with evidence, provenance, explicit effects, scoped approval, and frozen decisions. |
| 0.53.0 current | Shared visual-language foundation and a fully furnished, compact-safe Home surface. |

These are implementation facts, not retroactively invented milestones. Future completed work should
resume explicit milestone records or maintain a changelog so the public history does not drift again.

## Phase 4.5 foundation outcome

- The shared shell now has named material, typography, depth, focus, and motion tokens rather than
  relying only on one-off room colors.
- Home uses warm ambient light, linen and paper surfaces, a desk-like Return Pack, distinct project,
  household, capture, and Companion materials, and larger resident portraits.
- The shell exposes the current room as a stable styling hook for later room identities without
  coupling decoration to navigation behavior.
- At 1080×720 Home becomes a readable single column. The Electron suite asserts that both the
  document and Home surface remain horizontally contained.
- The final Companion form and the remaining room identities are intentionally separate furnishing
  passes; 0.53.0 does not pretend those assets are finished.

## Phase 4 outcome

### Reviewable practices, not hidden learning

- Hearth derives only two deliberately narrow practice families: the usual Workshop session type
  and repeated returns to one project. Both use explicit session kind, project identity, counts, and
  last activity time; conversation, commands, terminal output, source files, captures, and clipboard
  contents are excluded.
- Every suggestion shows its scope, supporting-record count, sanitized provenance, proposed effect,
  and a plain-language explanation before approval.
- Waiting suggestions may refresh when the same lifecycle evidence changes. Approval or dismissal
  freezes the observed evidence and wording so Hearth cannot silently rewrite a decision afterward.

### Deliberate control and bounded effect

- The House Memory drawer supports edit-before-approval, adopt, dismiss, restore, correct, and
  forget. Dismissed or forgotten observed practices remain locally suppressed so they do not quietly
  regenerate.
- An approved practice becomes bounded resident guidance only. It can improve relevance or favor a
  likely return path, but cannot start a session, choose a mode or provider, open or edit a file,
  install anything, approve a permission, or alter a security boundary.
- Project practices keep their original project identity when edited; changing the currently
  selected project cannot silently retarget an older memory.
- The drawer uses a full-width practice review card and remains contained at 1440×900 and 1080×720.

## Phase 3 outcome

### Typed, canonical references

- Capture recognizes ordinary web pages plus GitHub repositories, pull requests, issues, releases,
  and commits before any network request. Common tracking parameters and fragments are removed from
  the canonical record, so equivalent links deduplicate cleanly.
- Each saved link carries a typed source record with canonical URL, host, repository identity,
  retrieval state and time, and bounded public title, description, language, topics, and star data
  when available.
- Public enrichment retains the existing private-network and redirect checks, adds strict JSON size
  and time limits for GitHub's public API, and never sends credentials or fetches a private-network
  destination.

### Grounded surfaces and conversation

- The same quiet source card appears in Library, connected project notes, gathered Living Room
  context, and Archive detail. It states whether details were retrieved, failed, or remain
  unverified rather than blurring saved URLs with fetched facts.
- Librarian receives stable source IDs for saved records and separate recommendation IDs for
  discovery. Her contract requires factual claims to cite those records and to label inference,
  recommendation, and unverified metadata honestly.
- Hearth currently supplies no verified page-body quotations. Titles and descriptions remain
  metadata, and Librarian is explicitly forbidden from presenting them as verbatim quotations.
- Librarian remains advisory: conversation cannot clone, install, save, dismiss, edit, verify, or
  execute an item.

## Phase 2 outcome

### Honest context inspector

- The Workshop context meter is now an accessible button that opens a contained inspector rather
  than presenting one unexplained aggregate.
- Claude-reported context use and window size remain provider facts. Hearth's separate local
  manifest records exact prompt characters and never converts them into guessed tokens.
- Every new managed turn persists its bounded contributions: Hearth framing, current direction,
  recent conversation, explicit project evidence, terminal view, execution report, and approved
  House Memory. Each contribution records truncation truth and a plain-language boundary.
- Fresh and resumed sessions are explicit. On a resumed session, Hearth shows that prior
  conversation and House Memory were not resent because Claude carries its own provider-side
  history.

### Durable choices

- The manifest preserves a bounded recent user-direction tail and marks whether each direction was
  sent as recent context or retained only in Hearth's local record.
- At 70% or more of a provider-reported context window, the inspector offers three deliberate
  choices: keep working, prepare a Return Pack, or retire the continuation pointer and start fresh.
- ACP does not currently expose a reliable compaction event or hidden prompt breakdown. Hearth says
  so directly rather than inventing one; plans and tool results remain visible in the canonical
  workstream but are not mislabeled as material Hearth supplied.

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
Electron traces are retained for seven days. The complete workflow passed publicly on 2026-08-11
against commit `f4a7387`, including clean-runner provider fallback, canonical Windows paths, compact
layout behavior, ConPTY persistence, and full-exit recovery. The README now carries its status badge.

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

## Current quality signal

- Type checking, 112 unit tests across 15 files, the production build, and all 14 serial Electron
  scenarios pass for 0.52.0. The rebuilt 0.50.0 Claude/Codex packaged baseline also passes; the
  0.49.1 destructive health drill remains the latest runtime-failure evidence.
- The 0.52.0 Electron run exercised the complete practice review lifecycle, responsive containment,
  canonical reference capture, Library and Study cards, context
  inspection, migration persistence, compact containment, continuity, real ConPTY behavior, handoffs, Living Room,
  project-scoped conversations, reload/relaunch, and responsive layouts.
- Project discovery and edit recovery now compare canonical Windows paths, so short-path aliases such
  as `RUNNER~1` cannot make Hearth reject its own bounded recovery files. Project tests also close
  SQLite handles before removing their isolated workspaces.
- A stopped terminal can be reopened from the always-visible footer, so compact Workshop layouts do
  not depend on the hidden session shelf to start a fresh PowerShell session.
- The current rebuilt package passed both the local ConPTY smoke and the optional live Claude/Codex
  ACP smoke. Those remain required whenever provider, interruption, context, or permissions change.

The implementation plan for these findings and the selected Buzz/Hermes ideas is in
[roadmap.md](roadmap.md).
