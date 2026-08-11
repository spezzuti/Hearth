# Hearth roadmap

This roadmap starts from the real Hearth 0.53.0 implementation described in
[current-status.md](current-status.md). Historical milestone documents remain evidence of completed
work; they are not a backlog.

The roadmap incorporates useful ideas from recent
[Buzz Desktop 0.5.5](https://github.com/block/buzz/releases/tag/desktop-v0.5.5), the broader
[Buzz changelog](https://github.com/block/buzz/blob/main/CHANGELOG.md), and
[Hermes Agent 0.20.0](https://github.com/NousResearch/hermes-agent/releases/tag/v2026.8.3) without
changing Hearth into a team-chat network, autonomous agent swarm, browser, or generic plugin host.

## Fit against the current product

| External signal | Hearth already has | Integrated change |
| --- | --- | --- |
| Buzz ACP steering and session isolation | Project-scoped managed Maker sessions and safe cancel-then-replace interruption | Preserve the existing session model; add activity-aware health, explicit recovery, and better failure fate. |
| Buzz stall, timeout, usage, and harness work | A fixed turn timeout, persisted lifecycle summaries, session tokens, and orphan cleanup on relaunch | Add heartbeats, idle-versus-absolute limits, per-turn usage, adapter/process diagnostics, and visible recovery choices. |
| Buzz repository, PR, and issue entity cards | Library links, Git review, project discovery, and guarded external opening | Add typed reference cards and project connections without embedding a browser or GitHub client. |
| Hermes `/context`, `/focus`, and live work visibility | Context meter, compact Workshop layout, plans, thoughts, tool activity, diffs, and subagent markers | Add an honest context inspector and improve existing workstream performance rather than duplicating the terminal UI. |
| Hermes grounded citations and fact checking | Bounded Librarian retrieval and curated repository discovery | Attach verifiable source records to research claims and visibly separate sourced facts, recommendations, and uncertainty. |
| Hermes learned approvals and self-improving skills | User-approved House Memory and modest metadata-derived suggestions | Propose reviewable House Practices; never create active skills or permissions without approval. |
| Hermes/Buzz conversational voice | Paired mobile Companion and residents with established conversational identities | Add push-to-talk and barge-in later, after provider trust and context are solid. |
| Hermes A2A and Buzz bring-your-own harness | Separate Claude and Codex ACP routes | Keep an adapter seam in mind, but defer general agent interoperability until a real workflow requires it. |

## Phase 0 — trust baseline delivered in 0.48.0 and publicly proven in 0.50.0

The implementation, local release evidence, and first complete public Windows run are now green. The
repository status badge reports the same locked-install, audit, type, unit, build, and Electron gate.

### Dependency and packaging repair

1. Applied the smallest transitive lockfile updates that resolve `fast-uri`, `hono`, and
   `brace-expansion` advisories.
2. Both the production and complete dependency audits are clean.
3. Claude ACP 0.65.0, Codex ACP 1.1.10, `node-pty` beta.15, and Electron 43.3.0 were upgraded and
   verified in separate commits.
4. Typecheck, 106 unit tests, 13 Electron scenarios, a rebuilt packaged ConPTY smoke, and the live
   Claude/Codex ACP workstream plus interruption smoke passed on Windows.

### Public verification

1. A Windows GitHub Actions gate now covers locked install, production audit, typecheck, unit tests,
   build, and the deterministic Electron suite.
2. The complete 13-scenario Electron suite now passes on the hosted Windows runner without requiring
   Claude Code to be globally installed; provider-dependent checks use truthful local fallback.
3. The README status badge now reflects the complete meaningful workflow.

### Provider truth

1. Fixed live model labels were replaced with provider- or transcript-reported identity where
   available.
2. Configured Claude aliases and unreported model identity are now explicit.
3. Provider, fallback, local, degraded, and unavailable states remain separate.

**Exit met:** zero known dependency audit findings, clean packaged shutdown and interruption, no UI
claiming more provider certainty than Hearth possesses, and a complete green public Windows run.

## Phase 1 — Workshop turn health and Provider Doctor field-proven in 0.49.1

This is the first product milestone inspired by Buzz. The runtime, persistence, renderer, recovery
controls, and read-only diagnostics are implemented and verified in the packaged Windows app. The
0.49.1 health drill closes the live long-tool, adapter-loss, and pending-permission release gate.

### Turn-health model

- Tracks turn start, last provider event, last tool event, pending permission, child-process state,
  connection state, and terminal activity as bounded lifecycle metadata.
- Uses a renewable ten-minute idle deadline plus a separate two-hour safety ceiling. Permission waits and known
  long-running tools must not look like model stalls.
- Surfaces concise states such as **working**, **waiting for you**, **quiet but connected**,
  **reconnecting**, **stalled**, **interrupted**, and **failed**.
- Records the failure class and fate without persisting raw provider output.
- Never automatically replays a turn that may have performed a mutation. Recovery can continue the
  project-scoped session, consciously resend the direction, or retire the continuation pointer and
  start fresh. Mutating turns carry a visible warning.

### Provider Doctor

- Shows installed provider and adapter versions, executable discovery, authentication readiness,
  handshake result, active child process, current project session, last successful turn, and last
  bounded error.
- Existing orderly shutdown and orphan-turn cleanup remain explicit; the release gate exercises
  adapter shutdown and permission cleanup.
- Shows bounded setup guidance; it does not silently install or reauthenticate providers.

### Usage truth

- Stores and displays usage per managed turn/provider round when reported. Transcript-only totals
  are used only when a prior baseline makes an honest delta possible.
- Keeps session totals, context-window use, cache reads/writes, and estimated local payload size
  visually distinct.

**Exit met:** 109 deterministic unit tests, all 13 Electron scenarios, and the production build
pass; health renewal, interruption,
permission cleanup, restart fate, conscious retry, and fresh-session retirement are represented in
the implementation. The packaged live drill kept a known tool healthy beyond a compressed idle
deadline, recorded non-replayed adapter loss, and proved a pending write was not performed across
close and relaunch.

## Phase 2 — context inspector and durable continuity delivered in 0.50.0

This extends the existing Workshop counter rather than inventing a second context system.

- The context meter opens a contained, keyboard-dismissable inspector.
- Provider-reported tokens/window size and Hearth's character-exact local manifest are visually and
  semantically separate.
- The persisted manifest covers Hearth framing, the current direction, recent conversation,
  explicit project evidence, bounded terminal view, execution report, and approved memory. It also
  records truncation boundaries without persisting raw terminal output or arbitrary project files.
- Fresh versus resumed Claude sessions are explicit. A bounded recent user tail shows which
  directions were resent and which remain local continuity only.
- At 70% or more of a reported window, the inspector offers **keep working**, **start fresh**, and
  **prepare a Return Pack**. Hearth never resets automatically.
- ACP currently exposes no reliable compaction event or hidden provider prompt breakdown. The
  inspector states that limitation and does not misclassify provider-generated plans or tool results
  as Hearth-supplied material.

**Exit met:** the user can tell what Claude reported, what Hearth supplied this turn, what Hearth
will retain locally, and which continuity choices are available without confusing characters for
tokens or claiming visibility into provider-private state.

## Phase 3 — grounded Library and project references delivered in 0.51.0

This combines Hermes-style source grounding with Buzz-style entity cards.

- Recognizes repository, pull request, issue, release, commit, and ordinary web references during
  capture without fetching private-network destinations.
- Stores canonical URL, source kind, title, repository/project relationship, retrieval time, and
  bounded public metadata.
- Renders calm reference cards in Library, Study handoffs, Living Room context, and Archive detail.
- Requires Librarian research claims to point to the supplied source records. Distinguishes direct
  evidence, inference, recommendation, and unverified metadata.
- Treats no title or description as verified quotation text. Until bounded page-body records exist,
  Librarian is explicitly forbidden from presenting verbatim quotations.
- Preserves the current rule that Librarian cannot clone, install, save, dismiss, edit, or execute
  through conversation.

**Exit met:** a recommendation explains why it is present and where the supporting fact came from, while
Hearth remains a home base rather than an embedded browser or GitHub replacement.

## Phase 4 — supervised House Practices delivered in 0.52.0

This is Hearth's safe interpretation of self-improving skills and learned approvals.

- Detects repeated, low-risk workflow patterns only from explicit lifecycle metadata or a separately
  approved sanitized fingerprint.
- Suggests a practice with scope, evidence count, proposed effect, provenance, and a plain-language
  explanation.
- Lets the user approve, edit, dismiss, restore, or forget it through House Memory.
- Keeps command approvals separate from conversational preferences. A remembered habit never
  grant file, terminal, network, provider, or destructive authority.
- Defers shareable skills until provenance, versioning, update review, signature/checksum,
  and uninstall behavior exist. Discovery is not installation.

**Exit met:** Hearth becomes more familiar through reviewable habits without silently rewriting resident
prompts or permission policy.

## Phase 4.5 — furnish the house

The first foundation pass shipped in 0.53.0. It establishes a coherent visual language and furnishes
Home without moving, renaming, or weakening any workflow.

### Delivered foundation and Home

- Added shared plaster, linen, paper, painted wood, copper, and brass tokens with consistent raised
  and settled surface depth.
- Improved focus visibility, selection, control motion, reduced-motion behavior, and material
  contrast across the shared shell.
- Gave Home warmer ambient light, a desk-like Return Pack, clearer panel identities, a more present
  household, and an ember-like system state.
- Made Home deliberately fall to one readable column at compact desktop widths instead of squeezing
  resident identity and controls into narrow cards.
- Added an explicit room identity hook to the shell so later rooms can vary atmosphere while staying
  visibly inside the same house.

### Remaining furnishing passes

1. Furnish Study and Workshop as related working rooms: stronger focus, restrained technical
   materials, and no loss of terminal density or Claude Code readability.
2. Furnish Library and Studio with distinct shelf/paper and creative-work surfaces while preserving
   their current information architecture.
3. Furnish Living Room and Archive around shared discussion and quiet retention respectively.
4. Complete the Companion's final expressive visual identity, then tune resident expression and
   presence across their established surfaces.
5. Refresh public screenshots only after every room passes full-size, 1080×720, 1040×700, scaling,
   wrapping, focus, copy/paste, and reduced-motion review.

**Exit:** Hearth feels inhabited and visually coherent during daily use, while every room remains a
working surface rather than a literal space the user must navigate.

## Phase 5 — conversational voice

Voice belongs to Companion and resident conversation, not to a new always-listening subsystem.

1. Start with opt-in push-to-talk on desktop and paired mobile Companion.
2. Stream transcription into the normal composer so the user can inspect or send it.
3. Add clause-level spoken replies and explicit barge-in that maps to the same safe interruption
   semantics as typed redirection.
4. Keep microphone state unmistakable and expose provider, retention, and local/cloud processing.
5. Defer wake words until on-device detection, battery use, false activation, and Windows privacy
   behavior are proven.

**Exit:** voice feels like talking to a resident, can redirect active work safely, and never hides
when audio is being captured or transmitted.

## Later evaluation — interoperability and extensions

A2A, generic ACP harnesses, outbound webhooks, and a plugin SDK remain research items, not committed
product scope. Reconsider them only when at least one concrete Hearth workflow cannot be served by
Maker, Critic, Librarian, Companion, the existing terminal, or a narrow provider adapter.

Hearth should not adopt:

- Buzz channels, communities, Nostr relay, or social-feed architecture;
- autonomous skill creation or hidden transcript mining;
- automatic permission allowlists;
- an embedded general browser;
- arbitrary resident/plugin code in the renderer or core; or
- silent replay of failed mutating agent turns.

## Continuous quality lane

Every phase carries the same non-feature work:

- keyboard focus, Enter/Shift+Enter, copy/paste, links, text wrapping, and scroll anchoring;
- 1440×900, 1080×720, 1040×700, and narrow Companion layouts;
- long unbroken content, Unicode, high-DPI scaling, and Windows text rendering;
- renderer reload, relaunch, project switching, session isolation, and exact current-project truth;
- zero leaked personal paths, credentials, terminal scrollback, or project source in fixtures,
  screenshots, notifications, or persisted conversation; and
- a milestone or changelog entry whenever shipped behavior changes.
