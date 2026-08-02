# ADR 0002: Workshop terminal ownership

Status: Accepted for Hearth 0.2

## Decision

Hearth owns one interactive terminal in the local core utility process. The disposable renderer attaches an xterm.js viewport to a ConPTY session provided by `node-pty`.

The core is authoritative for:

- Hearth session identity
- project and working directory
- process identity and lifecycle
- shell or Claude Code kind
- user or Maker ownership
- Claude session identity and resume metadata
- capped in-memory scrollback

The renderer is authoritative only for presentation, selection, search UI, and the current viewport dimensions.

## Continuity

Room navigation and renderer replacement detach the viewport without stopping the process. Reattachment returns a sequence-numbered scrollback snapshot before accepting later output events, preventing duplicate playback.

Full application exit stops the current ConPTY process tree, persists a stopped lifecycle, and closes the core. A named Claude Code session can be resumed on the next launch; a PowerShell process is reported as stopped and is never presented as resumable.

## Input and ownership

Only one owner exists at a time:

- `user` allows keyboard and paste input from the terminal viewport.
- `maker` locks viewport input and permits an explicit bounded instruction from Maker’s side panel into a Claude Code session.

Changing ownership does not imply autonomous work. Until Maker has a real model adapter, its conversation remains local and the instruction relay is always user-triggered.

## Output and memory

Raw terminal output is capped at 512 KiB in the core for reattachment and is discarded on full exit. It is not persisted, indexed, summarized automatically, or mixed into household memory.

## Rendering

xterm.js owns terminal cell measurement and reflow. Hearth uses Cascadia when available, the standard renderer inside Electron’s hardware-accelerated surface, the fit addon, screen-reader rows, bounded scrollback, debounced ResizeObserver fitting, modifier-gated web links, and native clipboard events. The separate WebGL addon was measured and removed because it increased the active Workshop working set without a material visual improvement in the resize suite.
