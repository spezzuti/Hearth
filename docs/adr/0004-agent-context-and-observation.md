# ADR 0004: Explicit agent context and transient observation

Status: Accepted for Hearth 0.4

## Decision

Maker and Critic receive project evidence only through an explicit handoff from the Project room. A handoff identifies one discovered project and one bounded subject:

- the project summary;
- one previewed text file; or
- one complete or per-file Git diff.

The core revalidates the opaque project ID and relative path, derives a compact evidence packet, and persists only the reference, summary, evidence labels, and review concerns. It does not persist a second copy of source text or diff contents.

## Critic boundary

Critic is a separate conversational role. Critic:

- never becomes a terminal owner;
- cannot type into Claude Code;
- cannot execute commands;
- receives only the handoff deliberately selected by the user; and
- may disagree with Maker without blocking the workflow.

The current personalities are local, deterministic responses grounded in the selected packet. They are not presented as direct model reasoning.

## Terminal observation

Raw terminal output remains capped in memory and is discarded on full exit. The core derives a small transient observation containing:

- semantic state: quiet, ready, working, attention, or failed;
- one sanitized, bounded current line;
- whether the visible output appears to require user input; and
- an observation timestamp.

ANSI, OSC, and control sequences are removed. The observation is delivered as a sequence-numbered terminal event and is never written to SQLite.

## Clipboard truth

Clipboard writes are verified by reading back the requested text. Hearth retries short-lived Windows contention and reports failure if the OS never accepts the value. The interface must not claim that text was copied merely because Electron's write call returned.

## Deferred

- Model-backed Maker and Critic adapters
- Autonomous handoff policy
- Provider credentials
- Approval classification beyond visible terminal prompts
- Source edits or Git mutation
