# Hearth roadmap

This roadmap starts from the real Hearth 0.47.2 implementation described in
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

## Phase 0 — restore the trust baseline

This phase blocks feature work.

### Dependency and packaging repair

1. Apply the smallest transitive lockfile updates that resolve `fast-uri`, `hono`, and
   `brace-expansion` advisories.
2. Verify `npm audit --omit=dev` is clean and document any remaining build-only advisory accurately.
3. Evaluate Claude ACP 0.65.x, Codex ACP 1.1.9, `node-pty` beta.15, and the current Electron patch in
   separate commits. Do not combine native or ACP upgrades.
4. Run typecheck, unit tests, the complete Electron suite, packaged ConPTY smoke, live Claude/Codex
   ACP smoke, interruption, permission cleanup, and installer launch/quit cleanup.

### Public verification

1. Add a Windows GitHub Actions gate for install, typecheck, unit tests, build, and production audit.
2. Prove whether the complete Electron suite is stable on the hosted Windows runner. If not, publish
   a smaller deterministic smoke there and keep the full suite as a documented release gate.
3. Add a status badge only after the workflow is consistently meaningful.

### Provider truth

1. Replace fixed live model labels with provider-reported identity where available.
2. Label configured defaults and unreported runtime identity honestly.
3. Keep provider, fallback, degraded, authenticating, and unavailable states semantically separate.

**Exit:** zero known runtime audit findings, a green public gate, clean packaged shutdown, and no UI
claiming more provider certainty than Hearth possesses.

## Phase 1 — Workshop turn health and Provider Doctor

This is the first product milestone inspired by Buzz.

### Turn-health model

- Track turn start, last provider event, last tool event, pending permission, child-process state,
  connection state, and terminal activity as bounded lifecycle metadata.
- Use a renewable idle deadline plus a separate absolute safety ceiling. Permission waits and known
  long-running tools must not look like model stalls.
- Surface concise states such as **working**, **waiting for you**, **quiet but connected**,
  **reconnecting**, **stalled**, **interrupted**, and **failed**.
- Record the failure class and fate without persisting raw provider output.
- Never automatically replay a turn that may have performed a mutation. Recovery offers may resume
  the session, start a fresh session, retry only an explicitly safe turn, or open the technical
  details.

### Provider Doctor

- Show installed provider and adapter versions, executable discovery, authentication readiness,
  handshake result, active child process, current project session, last successful turn, and last
  bounded error.
- Detect and reap stale managed adapter processes during orderly startup and shutdown tests.
- Keep setup and repair actions visible; do not silently install or reauthenticate providers.

### Usage truth

- Store and display usage per managed turn/provider round when reported.
- Keep session totals, context-window use, cache reads/writes, and estimated local payload size
  visually distinct.

**Exit:** a long healthy tool run does not die because it was quiet, a real stall has an understandable
fate, and every recovery path is tested against interruption and permission cleanup.

## Phase 2 — context inspector and durable continuity

This extends the existing Workshop counter rather than inventing a second context system.

- Make the context meter open a compact inspector.
- Show provider-reported context use and locally measured contributions separately.
- Break down only material Hearth can prove it supplied: current instruction, visible recent turns,
  project evidence, approved House Memory, tool summaries, plans, and handoff context.
- Record visible compaction/resume events and the recent user-message tail preserved by Hearth.
- Offer **continue**, **start fresh**, and **prepare a Return Pack** choices at meaningful thresholds;
  do not auto-reset a working session.
- Keep raw project contents, terminal output, hidden prompts, and provider-private buffers out of the
  inspector and database.

**Exit:** the user can tell why a session is getting full, what Hearth knows will survive, and which
numbers are reported versus estimated.

## Phase 3 — grounded Library and project references

This combines Hermes-style source grounding with Buzz-style entity cards.

- Recognize repository, pull request, issue, release, commit, and ordinary web references during
  capture without fetching private-network destinations.
- Store canonical URL, source kind, title, repository/project relationship, retrieval time, and
  bounded public metadata.
- Render calm reference cards in Library, Study handoffs, Living Room context, and Archive detail.
- Require Librarian research claims to point to the supplied source records. Distinguish direct
  evidence, inference, recommendation, and unverified metadata.
- Verify quotations against retrieved page text before presenting them as quotations.
- Preserve the current rule that Librarian cannot clone, install, save, dismiss, edit, or execute
  through conversation.

**Exit:** a recommendation explains why it is present and where the supporting fact came from, while
Hearth remains a home base rather than an embedded browser or GitHub replacement.

## Phase 4 — supervised House Practices

This is Hearth's safe interpretation of self-improving skills and learned approvals.

- Detect repeated, low-risk workflow patterns only from explicit lifecycle metadata or a separately
  approved sanitized fingerprint.
- Suggest a practice with scope, evidence count, proposed effect, provenance, and a plain-language
  explanation.
- Let the user approve, edit, dismiss, restore, or forget it through House Memory.
- Keep command approvals separate from conversational preferences. A remembered habit must never
  grant file, terminal, network, provider, or destructive authority.
- Consider shareable skills only after provenance, versioning, update review, signature/checksum,
  and uninstall behavior exist. Discovery is not installation.

**Exit:** Hearth becomes more familiar through reviewable habits without silently rewriting resident
prompts or permission policy.

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
