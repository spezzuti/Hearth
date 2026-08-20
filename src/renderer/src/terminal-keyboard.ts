type TerminalKeyboardEvent = Pick<
  KeyboardEvent,
  "altKey" | "code" | "ctrlKey" | "key" | "metaKey" | "shiftKey" | "type"
>;

/**
 * Browser focus handling can consume Shift+Tab before xterm emits its VT input.
 * Windows ConPTY collapses legacy CBT (ESC [ Z) to a plain Tab before Claude
 * Code can distinguish the Shift modifier. Windows Terminal uses the Kitty
 * keyboard protocol for modified Tab, encoded as CSI 9;2u. Forward that exact
 * sequence so Claude Code can cycle permission modes inside Hearth.
 */
export function nativeTerminalKeySequence(
  event: TerminalKeyboardEvent
): string | null {
  if (
    event.type === "keydown" &&
    (event.key === "Tab" || event.code === "Tab") &&
    event.shiftKey &&
    !event.altKey &&
    !event.ctrlKey &&
    !event.metaKey
  ) {
    return "\x1b[9;2u";
  }
  return null;
}
