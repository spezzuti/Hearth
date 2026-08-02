# ADR 0035: Maker Terminal Sight

## Context

Workshop exposed one terminal owner at a time and could pass an approved Maker proposal into Claude
Code. The adjacent Maker conversation, however, received only a tiny state summary such as
**Active in terminal**. The interface said Maker had control while Maker truthfully said he could
not see the work. The user had to copy terminal output into chat, defeating the point of keeping a
resident beside the working session.

Terminal sight and terminal action are separate capabilities. Maker needs enough sight to discuss
what is happening without gaining an invisible route to type, approve, or execute.

## Decision

When a live Workshop session is explicitly assigned to Maker, each non-social Maker conversation
turn receives a transient recent-terminal view:

- ANSI and control sequences are removed;
- consecutive blank lines are collapsed;
- individual lines, total lines, and total characters are bounded;
- common credential assignments, authorization headers, and known token shapes are redacted;
- the exact prompt delimiter is neutralized; and
- the view remains in process memory and is never persisted.

The provider prompt labels the view incomplete, unverified, and untrusted. Maker may reason directly
from what is visible but must not claim to have produced or verified it. Other residents never
receive the view.

The terminal seat still does not authorize autonomous chat-driven input. Sending instructions to
Claude Code continues to require a saved Maker proposal, explicit user approval, Maker's terminal
seat, and the existing bounded relay.

Workshop now says **I can see the terminal** and **Maker can read the recent terminal** instead of
the ambiguous **I have control** and **Maker has the keyboard**.

## Consequences

- Maker can follow Claude Code, command output, failures, and the current prompt without copy/paste.
- The user's explicit terminal-seat choice is the visibility gate.
- Ordinary social messages still receive no work or terminal context.
- The recent view may omit older or heavily redrawn terminal content; Maker must say when the
  bounded evidence is insufficient.
- Some unknown credential formats may not be recognized, so users should still avoid printing
  secrets into any AI-assisted terminal.
