# ADR 0020: Bounded mobile decisions

## Context

The private Companion can show current context, accept captures, and hold a real conversation.
Useful work away from the desk also includes small decisions, but a general remote-control API would
collapse the deliberate safety boundary around Workshop, project files, and resident handoffs.

Idea state is already persistent, reversible, and non-executing. Maker proposals and execution
reports are useful to see remotely, but their desktop actions can start or reshape consequential
work.

## Decision

The phone may change only an idea's state between **pursuing**, **resting**, and **let-go**. The
Companion service accepts a capture identifier and one fixed state, then delegates to the same local
core method used by Studio. The core verifies that the record exists and is actually an idea.

The current Maker handoff may be projected into the phone snapshot as a bounded summary. The
projection can include the instruction, rationale or result decision, status, and aggregate counts.
It excludes root paths, context paths, expected-file lists, changed-file lists, corroboration paths,
terminal output, and source contents.

No mobile endpoint is added for proposal editing, approval, Claude Code handoff, terminal input,
terminal ownership, Critic handoff, report closure, file reading, file editing, project switching,
or command execution.

An open phone page may quietly surface the existing bounded Workshop observation when input is
required. Hearth does not request notification permission or promise delivery while the page is
closed.

## Consequences

- Common idea triage works from a phone and remains reversible on either device.
- The desktop refreshes after a remote decision without moving database data through renderer IPC.
- A Maker plan or report can be checked remotely without creating a path from phone to execution.
- Attention is useful while Companion is open, but background push remains intentionally absent.
- Future mobile actions must be evaluated individually; this decision does not establish a general
  command or approval channel.
