# Milestone 8.1: Role-specific household models

Hearth 0.5.1 gives Maker and Critic deliberate, independent Claude model assignments.

## Delivered

- Maker explicitly requests the Claude Code `opus` alias, resolving to Claude Opus 5.
- Critic explicitly requests the `fable` alias, resolving to Claude Fable 5.
- Provider state retains a separate resolved model identity for each role.
- Study shows the model belonging to the active agent.
- Workshop always identifies Maker's model, regardless of which agent spoke last.
- Home summarizes both household models without implying a single global provider brain.
- Local mode and automatic local fallback remain unchanged.

## Verification

- Unit coverage locks the Maker-to-Opus and Critic-to-Fable routing contract.
- Live in-app calls resolved Maker to Claude Opus 5 and Critic to Claude Fable 5.
- Full Electron continuity and packaged ConPTY tests remain required for release.
