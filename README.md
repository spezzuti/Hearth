# Hearth

Hearth is a Windows-first working home for projects, agents, terminals, memory, and useful things.

This repository contains the continuity, Workshop, and Project Surface vertical slices:

- Sandboxed Electron renderer
- Separate local core utility process
- SQLite WAL persistence and startup backups
- Home, Living Room, and Study
- Truthful Return Packs
- Natural local Maker and Companion conversation
- Universal capture
- Leave, renderer reload, and relaunch continuity
- A real ConPTY terminal rendered with xterm.js
- Windows PowerShell and feature-detected Claude Code launch
- Named Claude Code sessions whose resumability is only claimed after real input
- An explicit user/Maker terminal seat: when Maker has it, his chat receives a bounded transient
  view of recent output while terminal instructions still require a deliberate handoff
- Bounded Maker-to-Claude instruction relay
- Room navigation and renderer reload without terminating the PTY
- Search, guarded links, clipboard integration, resize/reflow, and focus mode
- Intent-following terminal focus: start, resume, taking control, focus mode, search Escape, and one
  click on the terminal surface all return the typing caret without an extra activation click
- Fast discovery of repository and Claude/Codex projects under the Windows home folder
- A read-only Project room with search, bounded file previews, Git change review, and text wrapping
- Persistent working-project selection shared by Home, Study, and new Workshop sessions
- Project-aware PowerShell and named Claude Code startup
- Path containment, symlink refusal, binary detection, and file/diff size limits
- Integrated native Windows controls without a separate title or menu band
- Packaged-build project repair that rejects the install directory and selects a real repo
- Explicit project, file, and diff handoffs to Maker or Critic
- A separate Critic conversation with recognizable skepticism and no terminal ownership
- A persistent, project-separated Living Room transcript shared by the residents the user visibly
  calls into the discussion, without leaking their private room conversations
- One-resident conversation, two-to-four-person Roundtable, and a bounded adversarial Pressure Test
  that runs Maker, Critic, optional Librarian evidence, and Companion synthesis in a visible order
- Immediate user-message posting, streamed attributed resident turns, explicit cancellation, and
  reload/relaunch continuity for household discussions
- Searchable, renameable Living Room discussions with reversible put-away/restore, plus deliberate
  decision drafts for Maker, Workshop, or a project-connected note
- Explicit Library, Study, Workshop, and Home context cards when something is brought into the room;
  only the visible bounded summary is shared with the residents who were called
- Living Room project grounding limited to a bounded visible summary, with no terminal transcript or
  terminal authority; house-only discussions run outside the selected repository
- Namespaced Codex ACP sessions so Critic's Living Room turns cannot inherit Study history
- Bounded evidence summaries and review flags without persisting raw source or terminal output
- Clear Workshop language distinguishing Maker's recent-terminal sight from permission to send an
  approved instruction into Claude Code
- Transient terminal observations for ready, working, attention, and failed states
- Verified clipboard writes with honest Windows-unavailable feedback
- Deliberate Opus-generated Maker proposals with editable Claude Code instructions
- Persistent proposal rationale, expected scope, and candid risk/approval notes
- Explicit save, discard, terminal-ownership, and pass gates for proposed work
- Bounded Claude Code execution reports attached to the approved handoff
- Changed-file, validation, unresolved-concern, and decision fields without persisted terminal output
- Execution reports available to Maker as explicitly unverified evidence
- Git corroboration that separates Claude-reported paths from current working-tree evidence
- One-click execution-report and bounded-diff handoff to independent Critic review
- A real Library room backed by universal capture, search, project connections, editable names,
  notes, tags, pinning, reversible archiving, and exact-link deduplication
- First-class Library collections with visible counts, one-click shelf filtering, editable filing,
  an honest Unfiled state, and separate project connections and tags
- A deliberate, read-only PersonalOS Stacks bridge with a review step, active-link filtering,
  collection preservation, exact-URL deduplication, and safe repeat imports
- Optional guarded page-title and description enrichment without private-network requests
- A four-hour cached GitHub discovery shelf with separate curated, dependable, emerging, and skill
  views
- Repo relevance shaped by the selected project, saved Library collections and tags, and explicit
  taste feedback instead of popularity alone
- Fresh Claude Code and Codex skill searches with visible evidence checks, specialist-noise
  suppression, saved-link exclusion, and honest stale/offline states
- Provider-backed Librarian conversation over bounded catalog retrieval, with a fast local fallback
- Reversible **Not for me** feedback and a Hidden shelf for current recommendations
- Modest, explainable discovery ranking signals learned from what the user keeps or dismisses
- A real Studio room where ideas can rest, be deliberately pursued, be let go, and return later
- Canonical capture routing: links live in Library, ideas live in Studio, and notes remain loose
  or connect to a real project without becoming duplicate records
- Lightweight `@idea`, `@note`, `@ProjectName`, and `#tag` capture language with bare-link routing
- A calm Studio notebook for loose and connected notes, plus contextual Notes inside each project
- Whole-house search across notes, ideas, links, tags, project relationships, discovered projects,
  and approved House Memory
- A visible, correctable House Memory drawer for explicit preferences, workflows, tools, project
  habits, and resident relationships
- Reversible memory suggestions drawn only from bounded session metadata, never conversation text
  or terminal output
- House-, project-, and resident-scoped memory that reaches residents only after approval and never
  expands file, terminal, edit, or execution authority
- Database-backed retrieval beyond the recent working set, including material put away or let go
- Persistent, reversible idea decisions without scores, streaks, automatic tasks, or silent project creation
- A separate, persistent Maker conversation for each pursued idea, with immediate message posting,
  streamed replies, and no implied terminal or build authority
- Explicit Studio promotion into a discovered project without writing to that project
- Deliberate new-project creation under `Hearth Projects`, limited to a local marker and an
  `IDEA.md` origin file before the user chooses any tools or terminal
- Explicit editing for one selected, bounded UTF-8 project file at a time
- Local drafting followed by an exact line review, format and scope checks, and a separate Apply gate
- Stale-file refusal so Hearth never knowingly overwrites work changed after the review
- Atomic writes with private original-file backups and restart-safe Undo
- One-file Maker drafts from a deliberately selected preview and plain-language request
- Independent Critic review over the original and proposed file without Maker conversation leakage
- Resident proposals remain memory-only, tool-free, and subject to the same exact user Apply gate
- Local bounded filename and source search across deliberately allowlisted project text
- A six-file evidence shelf with visible snippets, explicit selection, and separate resident handoffs
- Persisted evidence paths without persisted raw source; contents are refreshed only for relevant turns
- A real Archive room projected from Return Packs, put-away Library items, let-go ideas, closed
  handoffs, and Hearth file-edit recovery
- Searchable, copyable Archive detail without a noisy activity feed or duplicated history table
- Explicit two-step permanent removal for every Archive record, with file-specific warnings and
  no authority to delete project files
- Bounded automatic startup-backup retention that keeps the newest eight snapshots while
  preserving manual backups
- Truthful recovery actions: Library and Studio restoration plus confirmed, verified file-edit Undo
- Historical Return Packs can be viewed transiently on Home without replacing current project or
  process truth
- Explicit Archive orientation into a related project, exact bounded file, or Workshop
- Project-switch confirmation that leaves live terminals and resident contexts untouched
- An opt-in, loopback-only Companion service with expiring pairing and session revocation
- Optional private tailnet HTTPS sharing through a detected Tailscale installation, never Funnel
- Conflict-safe use of a dedicated private HTTPS port without replacing existing Serve routes
- A responsive phone surface for status, Return Packs, captures, Companion conversation, and
  collapsible secondary history
- Real bounded Opus conversation for Companion with an explicit local-fallback label
- Immediate phone-to-desktop synchronization for captures and completed Companion turns
- A phone decision surface for reversible **Pursue**, **Let rest**, and **Let go** idea choices
- Read-only mobile summaries of active Maker plans and execution reports without paths or file lists
- Quiet Workshop-attention banners and browser-title state while the Companion page is open
- Immediate phone-to-desktop synchronization for idea decisions
- Silent Windows attention while Hearth is minimized for Workshop input and finished resident replies
- Opt-in minimized alerts for phone captures and idea decisions, folded behind **Alerts** on Home
- Notification click-through to Workshop, Study, Library, Studio, or Home without changing work
- Native Windows tray residency: **X** hides Hearth, a tray click restores it, and **Quit Hearth**
  performs the full shutdown
- Launching Hearth again restores the hidden working home rather than opening a competing instance
- Separate installed and development Windows identities so Electron tooling cannot contaminate
  Hearth's taskbar grouping
- Hearth's own ICO is assigned explicitly to the executable, window, taskbar relaunch identity, and
  packaged tray
- Distinct Maker, Librarian, and Critic portraits carried consistently through Home and their rooms
- First-class Maker and Librarian presence with larger room portraits and restrained live states
- A responsive Maker status lockup with the complete two-line model name and an evenly padded
  online light from the widest Workshop down to Hearth's minimum window
- A project-bound Maker conversation and managed Claude session, so changing working projects
  restores that project's own chat instead of carrying another project's thread across the house
- Claude Code-style Workshop interruption: sending a new direction while Maker is working cancels
  the active turn, marks it Interrupted, waits for the ACP session to release, and continues in that
  same project session without running two tool turns at once
- Live Claude Code context-token counts plus retained session input/output usage in Workshop
- A finished code-native Companion character with quiet idle, attentive, thinking, and reply states
- No Companion routes for terminals, project files, edits, execution, ownership, or project switching

Companion remote access requires Tailscale on the PC and phone, remains off until explicitly shared,
and still requires Hearth pairing. Resident portraits are bundled local artwork; Hearth does not
fetch or replace them at runtime.

## Run

```powershell
npm install
npm run dev
```

For a production-style local run:

```powershell
npm start
```

## Verify

```powershell
npm run verify
```

The end-to-end tests launch the real Electron application and prove continuity, shared Living Room
conversation, Roundtable and Pressure Test orchestration, context handoffs, discussion management,
decision drafting, Library curation,
Project Surface, agent handoffs, multi-file evidence search and selection, Critic review, Workshop
observation, native window controls, project discovery, file preview, Git diff review, compact
layouts, project-aware terminal startup, Studio conversation and promotion, bounded user and Maker
file-edit review, independent Critic challenge, apply and recovery, Archive search, source-specific
restoration, historical Home orientation, exact archived-file reopening, terminal-preserving project
switches, terminal input, paste when the Windows clipboard is available, long-line reflow, links,
renderer reattachment, searchable and scoped House Memory, explicit stop, full exit, and truthful
relaunch. The packaged smoke test
separately proves that an installed build selects the source project rather than its own executable
folder.

## Safety

Hearth is a new repository and never modifies PersonalOS. Project discovery reads only local folder
markers and metadata. File contents are read only for a deliberate preview, bounded local search, or
explicit resident evidence handoff. Studio promotion into an existing project stores the connection
in Hearth alone. Project-file writes occur only through the separately confirmed bounded editor or
an explicitly owned Workshop terminal.
