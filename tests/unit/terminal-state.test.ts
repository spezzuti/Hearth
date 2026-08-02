import { describe, expect, it } from "vitest";
import {
  isMissingClaudeConversation,
  observeClaudeInput
} from "../../src/core/terminal-state";

describe("Claude terminal continuity", () => {
  it("does not mark an assigned ID resumable until a prompt is submitted", () => {
    const typed = observeClaudeInput("", "review this repo");
    expect(typed).toEqual({
      buffer: "review this repo",
      submitted: false
    });

    const submitted = observeClaudeInput(typed.buffer, "\r");
    expect(submitted).toEqual({
      buffer: "",
      submitted: true
    });
  });

  it("handles editing and blank submissions without claiming a conversation exists", () => {
    const edited = observeClaudeInput("", "nope\b\b\byes\r");
    expect(edited).toEqual({
      buffer: "",
      submitted: true
    });
    expect(observeClaudeInput("", "   \r").submitted).toBe(false);
  });

  it("recognizes Claude's missing-conversation response across collected output", () => {
    expect(
      isMissingClaudeConversation(
        "Claude Code\r\nNO conversation found with session ID: 331b8c49"
      )
    ).toBe(true);
    expect(isMissingClaudeConversation("Claude Code is ready.")).toBe(false);
  });
});
