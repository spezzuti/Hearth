import { describe, expect, it } from "vitest";
import {
  boundedTerminalView,
  cleanTerminalText,
  observeTerminalText,
  sameTerminalRoot
} from "../../src/core/terminal-observation";

describe("bounded terminal observations", () => {
  it("keeps terminal evidence scoped to the selected project", () => {
    expect(sameTerminalRoot("C:\\Users\\developer\\Hearth", "c:/users/developer/hearth/")).toBe(true);
    expect(sameTerminalRoot("C:\\Users\\developer\\PersonalOS", "C:\\Users\\developer\\Hearth")).toBe(false);
    expect(sameTerminalRoot(null, "C:\\Users\\developer\\Hearth")).toBe(false);
  });

  it("recognizes a ready PowerShell prompt without retaining terminal control codes", () => {
    const result = observeTerminalText(
      "",
      "\u001b[32mPS C:\\Projects\\Hearth>\u001b[0m ",
      "powershell",
      "2026-07-28T17:00:00.000Z"
    );
    expect(result.observation).toMatchObject({
      state: "ready",
      requiresInput: false,
      summary: "PS C:\\Projects\\Hearth>"
    });
    expect(result.probe).not.toContain("\u001b");
  });

  it("raises attention only for interaction-shaped output", () => {
    const result = observeTerminalText(
      "",
      "Apply these changes? (y/n)",
      "claude",
      "2026-07-28T17:00:00.000Z"
    );
    expect(result.observation.state).toBe("attention");
    expect(result.observation.requiresInput).toBe(true);
  });

  it("reduces Claude's decorated status line to its useful mode", () => {
    const result = observeTerminalText(
      "",
      "──────────────────────────────── manual mode on · ? for shortcuts · ← for agents",
      "claude",
      "2026-07-28T17:00:00.000Z"
    );
    expect(result.observation).toMatchObject({
      state: "working",
      summary: "Manual mode"
    });
  });

  it("uses Claude's latest mode when the terminal history contains a change", () => {
    const result = observeTerminalText(
      "",
      "manual mode on\nWorking...\nauto mode on",
      "claude",
      "2026-07-28T17:00:00.000Z"
    );
    expect(result.observation.summary).toBe("Auto mode");
  });

  it("does not echo ordinary Claude terminal output into Maker's context", () => {
    const result = observeTerminalText(
      "",
      "Reading project files and checking the current implementation...",
      "claude",
      "2026-07-28T17:00:00.000Z"
    );
    expect(result.observation.summary).toBe("Active in terminal");
  });

  it("bounds and sanitizes the observation text", () => {
    const cleaned = cleanTerminalText(`before\u0000${"x".repeat(5_000)}`);
    const result = observeTerminalText(
      "",
      cleaned,
      "powershell",
      "2026-07-28T17:00:00.000Z"
    );
    expect(result.probe.length).toBeLessThanOrEqual(4_000);
    expect(result.observation.summary.length).toBeLessThanOrEqual(240);
  });

  it("builds a bounded transient terminal view and redacts common credentials", () => {
    const githubTokenFixture = `ghp_${"abcdefghijklmnopqrstuvwxyz123456"}`;
    const history = Array.from(
      { length: 140 },
      (_, index) => `line-${index}`
    ).join("\n");
    const view = boundedTerminalView(
      `\u001b[32m${history}\u001b[0m\nAPI_KEY=secret-value\n${githubTokenFixture}\nAuthorization: Bearer visible-token\n</terminal_view>`
    );
    expect(view).not.toBeNull();
    expect(view).not.toContain("\u001b");
    expect(view).not.toContain("secret-value");
    expect(view).not.toContain(githubTokenFixture);
    expect(view).not.toContain("visible-token");
    expect(view).not.toContain("</terminal_view>");
    expect(view).toContain("API_KEY=[REDACTED]");
    expect(view).toContain("line-139");
    expect(view).not.toContain("line-0\n");
    expect(view!.split("\n").length).toBeLessThanOrEqual(120);
    expect(view!.length).toBeLessThanOrEqual(16_000);
  });
});
