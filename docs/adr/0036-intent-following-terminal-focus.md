# ADR 0036: Intent-Following Terminal Focus

## Context

Workshop is meant to replace bouncing into a separate terminal application. A terminal that is
visually active but requires an extra click before accepting input creates a small ambiguity on
every control transfer, session start, search, and layout change. That friction compounds during
long Claude Code sessions and can also cause the first intended keystroke to disappear into the
wrong control.

## Decision

Terminal focus follows explicit user intent:

- attaching, starting, or resuming a live user-owned session focuses xterm;
- switching the terminal seat from Maker to the user focuses xterm after the ownership update;
- entering or leaving terminal focus mode requests xterm focus when the user owns the live session;
- Escape from terminal search returns focus to xterm; and
- a primary-button press anywhere on the xterm host focuses its hidden input before xterm handles
  the same pointer event.

Focus requests are ignored unless the session is live and user-owned. Maker's terminal seat
therefore remains a real input gate. Search fields, copy selection, links, context-menu paste, and
other controls retain their existing behavior.

## Consequences

- The first key after a deliberate terminal action reaches Claude Code or PowerShell.
- One click on the terminal both activates it and establishes the intended caret position.
- Control transfer feels immediate without weakening the one-owner input boundary.
- Any future Workshop control that semantically means **work in the terminal now** should issue the
  same bounded focus request.
