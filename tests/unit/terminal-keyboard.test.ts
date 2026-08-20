import { describe, expect, it } from "vitest";
import { nativeTerminalKeySequence } from "../../src/renderer/src/terminal-keyboard";

function keyEvent(overrides: Partial<KeyboardEvent> = {}): KeyboardEvent {
  return {
    altKey: false,
    code: "Tab",
    ctrlKey: false,
    key: "Tab",
    metaKey: false,
    shiftKey: true,
    type: "keydown",
    ...overrides
  } as KeyboardEvent;
}

describe("native terminal shortcuts", () => {
  it("forwards Shift+Tab using the Kitty keyboard protocol", () => {
    expect(nativeTerminalKeySequence(keyEvent())).toBe("\x1b[9;2u");
  });

  it("recognizes physical Tab when Chromium reports an unidentified key", () => {
    expect(nativeTerminalKeySequence(keyEvent({ key: "Unidentified" }))).toBe(
      "\x1b[9;2u"
    );
  });

  it("leaves plain Tab and modified chords to xterm", () => {
    expect(nativeTerminalKeySequence(keyEvent({ shiftKey: false }))).toBeNull();
    expect(nativeTerminalKeySequence(keyEvent({ ctrlKey: true }))).toBeNull();
    expect(nativeTerminalKeySequence(keyEvent({ altKey: true }))).toBeNull();
    expect(nativeTerminalKeySequence(keyEvent({ type: "keyup" }))).toBeNull();
  });
});
