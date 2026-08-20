# Reviewer guide

This guide is the shortest route through the parts of Hearth that matter technically. The full app
has more surfaces; a useful review does not need to click every room.

## What Hearth is testing

Hearth asks whether an AI coding environment can preserve three things at the same time:

1. the transparency and momentum of Claude Code's technical stream;
2. a natural conversational relationship with a project-aware builder;
3. strict, visible boundaries around context, execution, memory, and handoffs.

The result is not a generic chat shell and not a fully autonomous agent swarm. It is a local desktop
workflow system with one current project and several deliberately different modes of attention.

## Five-minute local evaluation

This path requires no model credentials.

```powershell
git clone https://github.com/spezzuti/Hearth.git
cd Hearth
npm ci
$env:HEARTH_AGENT_PROVIDER = "local"
npm run dev
```

1. **Home:** inspect the Return Pack, current-project truth, universal capture, and household state.
2. **Study → Projects:** select a repository, browse a file, inspect Git changes, and use **Find
   context** to see how explicit multi-file evidence is assembled.
3. **Workshop:** start PowerShell or Claude Code and verify that the main workbench is a real ConPTY
   rather than a styled or reconstructed activity stream.
4. **Living Room:** switch among Conversation, Roundtable, and Pressure test. Notice that the called
   residents and context card are visible before sending.
5. **Library / Studio:** capture a link and an `@idea`; each record has one canonical home rather than
   appearing as duplicated inbox items.
6. **Leave well:** create a Return Pack, reload, and confirm that Hearth describes actual process
   state instead of claiming a stopped terminal is live.

Local responses are intentionally labeled. They demonstrate the interface and capability model, not
live model quality.

## Live Claude Code evaluation

Install and authenticate Claude Code first, then run Hearth without the local-provider environment
variable.

### Workshop

1. Select a disposable repository in Study and choose **Work in _project_**.
2. Start or resume Claude Code.
3. Work in the main terminal exactly as you would in Windows Terminal. Claude's TUI owns the visible
   plan, tool activity, diffs, permissions, modes, effort, and token counters.
4. Use Shift+Tab to cycle Claude's permission mode and confirm that focus does not traverse Hearth's
   surrounding controls.
5. Talk to Maker through Claude Code in the terminal. The right rail supplies Maker's presence and
   project-scoped notebook while the terminal remains the one visible conversation and workstream.

### Independent review

1. In Study, select one file, several files, or no files for a bounded project-level summary.
2. Send the context to Critic.
3. When Codex ACP is authenticated, Critic uses that independent provider in read-only mode. If it is
   unavailable, Hearth visibly falls back to Claude Fable rather than presenting the review as
   independent Codex work.

### Shared decision

1. Bring the current project or Workshop state into Living Room.
2. Run a Pressure test with Maker and Critic; optionally include Librarian.
3. Draft the final household take back to Maker or Workshop. The text enters an editable composer—it
   does not start work automatically.

## Evidence map

| Claim | Implementation | Automated evidence |
| --- | --- | --- |
| Sandboxed renderer and narrow preload | `src/main/main.ts`, `src/main/preload.ts` | native-window and continuity E2E scenarios |
| Project path containment and bounded edits | `src/core/projects.ts` | `tests/unit/projects.test.ts`, project-review E2E scenarios |
| Real persistent ConPTY | `src/core/terminal.ts` | terminal-state unit tests and three terminal E2E scenarios |
| Native project-scoped Claude continuity | `src/core/terminal.ts`, `src/renderer/src/WorkshopRoom.tsx` | terminal-state tests, Claude-mode smoke, terminal Electron scenarios |
| Activity-aware turn health and failure fate | `src/core/claude-acp-runtime.ts` | managed-maker unit tests and packaged health drill |
| Truthful per-turn context manifest | `src/core/agent-provider.ts`, `src/core/store.ts` | agent-provider/store unit tests and Workshop Electron scenario |
| Safe active-turn interruption | `src/core/claude-acp-runtime.ts`, `src/core/core.ts` | deterministic interruption unit test and optional real-provider packaged smoke |
| Independent Critic routing | `src/core/codex-acp-runtime.ts`, `src/core/agent-provider.ts` | provider unit tests and packaged smoke |
| Bounded shared-room orchestration | `src/core/living-room.ts` | Living Room unit and Electron tests |
| Persistence and migrations | `src/core/store.ts` | store unit tests plus reload/relaunch E2E scenarios |
| Private Companion transport | `src/main/companion-transport.ts` | transport and server unit tests plus mobile E2E flow |

## Verification commands

```powershell
npm run typecheck
npm test
npm run test:e2e
npm run package:dir
npm run test:packaged:health
```

The complete `npm run verify` gate runs the first three. On the current release, that is 112 unit tests and
14 serial Electron scenarios. The E2E suite creates synthetic repositories and isolated application
data; it does not use the reviewer's personal Hearth database.

The optional packaged live-provider smoke is controlled by environment flags in
`scripts/packaged-smoke.mjs`. It can verify Claude ACP, Codex ACP, detailed workstream events,
session resume, and mid-turn interruption against the packaged executable.

`npm run test:packaged:health` is the destructive live release drill. It uses isolated app data,
runs a bounded long-tool soak, terminates only the validated Claude adapter descendant, and closes
the app with an unresolved test permission. Run it only against a freshly built unpacked app and a
bounded test direction; its assertions require authenticated Claude Code.

## Known limitations worth reviewing

- Windows x64 is a deliberate v1 constraint, not a cross-platform abstraction that happens to be
  untested elsewhere.
- The app is pre-1.0 and has been shaped around one primary user's workflow; first-run onboarding and
  accessibility need broader testing.
- Local fallbacks are useful for interface continuity but are not replacements for live reasoning.
- GitHub discovery is relevance-shaped but intentionally modest; it is not a package-security or
  popularity oracle.
- The Companion mobile surface is a paired private control surface, not a general hosted web app.

## Why this may be interesting to Anthropic

Hearth is an opinionated downstream experiment in Claude Code UX. It uses ACP to preserve the agent
loop while exploring product questions around active-run interruption, human-readable parallel
conversation, project-scoped continuity, explicit context assembly, independent review, and safe
movement between discussion and execution.

It was developed through human-directed work with multiple coding agents rather than being
presented as a Claude-only artifact. The relevant contribution is the workflow and integration
layer around Claude Code, backed by executable tests and explicit capability boundaries.
