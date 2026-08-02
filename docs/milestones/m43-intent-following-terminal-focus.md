# Milestone 43: Intent-Following Terminal Focus

Hearth 0.38.0 removes the extra activation click from everyday Workshop use.

## Delivered

- Immediate terminal focus after start and resume.
- Immediate caret return when the user takes the terminal seat from Maker.
- First-click focus anywhere on the xterm surface.
- Escape from output search returns directly to terminal typing.
- Terminal focus follows entry into and exit from the expanded terminal layout.
- Focus remains blocked while Maker has the terminal seat.
- Workshop copy now calls the roles **your seat** and **Maker seat** rather than vaguely promising
  keyboard control.

## Verification

- Real Electron and ConPTY coverage proves initial focus, focus after clicking away, first-click
  terminal activation, Escape-to-terminal behavior, and focus after taking the seat from Maker.
- The same run retains copy/paste, Unicode, link, resize, navigation, renderer-reattachment, and
  explicit-stop coverage.
- Type checking and the complete unit suite remain green.

## Principle

When the user's intent to type is obvious, the caret should already be waiting.
