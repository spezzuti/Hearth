import { describe, expect, it, vi } from "vitest";
import {
  ClaudeAcpRuntime,
  findClaudeAcpAdapter,
  latestClaudeTranscriptUsage,
  makerModeOptions,
  nextMakerEffort,
  nextMakerMode,
  normalizeClaudeToolActivity,
  requestedMakerMode
} from "../../src/core/claude-acp-runtime";
import { coreRequestSchema } from "../../src/shared/contracts";

describe("managed Maker boundary", () => {
  it("ships the Claude ACP adapter used by the Workshop harness", () => {
    expect(findClaudeAcpAdapter()).toMatch(/claude-agent-acp[\\/]dist[\\/]index\.js$/);
  });

  it("keeps managed work and permission decisions explicit in the core contract", () => {
    expect(
      coreRequestSchema.parse({
        id: "managed-message",
        method: "sendAgentMessage",
        payload: {
          agent: "maker",
          text: "Inspect the project.",
          surface: "workshop"
        }
      }).payload
    ).toMatchObject({ surface: "workshop" });

    expect(
      coreRequestSchema.parse({
        id: "permission-response",
        method: "resolveMakerPermission",
        payload: {
          permissionId: "31a14d64-f394-45d3-af05-70268f9ba933",
          optionId: "allow_once"
        }
      }).method
    ).toBe("resolveMakerPermission");

    expect(
      coreRequestSchema.parse({
        id: "session-control",
        method: "configureMakerSession",
        payload: { control: { kind: "effort", value: "high" } }
      }).method
    ).toBe("configureMakerSession");
  });

  it("interrupts an active Workshop turn and continues in the same ACP session", async () => {
    const runtime = new ClaudeAcpRuntime("claude.exe");
    const internal = runtime as unknown as {
      ensureSession: () => Promise<{
        connection: {
          agent: {
            request: (_method: unknown, params: Record<string, unknown>) => Promise<Record<string, unknown>>;
            notify: (_method: unknown, params: Record<string, unknown>) => Promise<void>;
          };
        };
        sessionId: string;
        resumedPriorSession: boolean;
      }>;
      turns: Map<string, { reply: string }>;
      connection: unknown;
    };
    let promptCount = 0;
    let resolveFirst!: (value: Record<string, unknown>) => void;
    const firstResponse = new Promise<Record<string, unknown>>((resolve) => {
      resolveFirst = resolve;
    });
    const connection = {
      agent: {
        request: async (_method: unknown, params: Record<string, unknown>) => {
          if (!("prompt" in params)) return {};
          promptCount += 1;
          if (promptCount === 1) return firstResponse;
          internal.turns.get("maker-session")!.reply = "Changed direction cleanly.";
          return { stopReason: "end_turn" };
        },
        notify: async () => {
          resolveFirst({ stopReason: "cancelled" });
        }
      }
    };
    internal.connection = connection;
    internal.ensureSession = async () => ({
      connection,
      sessionId: "maker-session",
      resumedPriorSession: false
    });

    const first = runtime.reason(
      "C:\\Projects\\Hearth",
      "first-request",
      "Start the long job.",
      () => undefined
    );
    await vi.waitFor(() => {
      expect(internal.turns.has("maker-session")).toBe(true);
    });
    const second = runtime.reason(
      "C:\\Projects\\Hearth",
      "second-request",
      "Stop that and do this instead.",
      () => undefined,
      { interruptActive: true }
    );

    await expect(first).rejects.toMatchObject({
      reason: "interrupted"
    });
    await expect(second).resolves.toBe("Changed direction cleanly.");
    expect(promptCount).toBe(2);
  });

  it("turns explicit conversational mode requests into real ACP modes", () => {
    expect(requestedMakerMode("Switch to plan mode and inspect this first.")).toBe("plan");
    expect(requestedMakerMode("Go back to auto.")).toBe("auto");
    expect(requestedMakerMode("Use manual mode for this one.")).toBe("default");
    expect(requestedMakerMode("/plan review the architecture")).toBe("plan");
    expect(requestedMakerMode("Make a plan before you touch anything.")).toBeNull();
  });

  it("only exposes the three everyday modes in their intended cycle", () => {
    const modes = makerModeOptions({
      currentModeId: "default",
      availableModes: [
        { id: "auto", name: "Auto", description: "Automatic permission decisions" },
        { id: "default", name: "Manual", description: "Ask when needed" },
        { id: "acceptEdits", name: "Accept Edits", description: "Legacy extra" },
        { id: "plan", name: "Plan Mode", description: "Read-only planning" },
        { id: "dontAsk", name: "Don't Ask", description: "Legacy extra" }
      ]
    });

    expect(modes.map((mode) => [mode.id, mode.name])).toEqual([
      ["default", "Manual"],
      ["auto", "Auto"],
      ["plan", "Planning"]
    ]);
    expect(nextMakerMode(modes, "default")?.id).toBe("auto");
    expect(nextMakerMode(modes, "auto")?.id).toBe("plan");
    expect(nextMakerMode(modes, "plan")?.id).toBe("default");
    expect(nextMakerMode(modes, "default", "planning")?.id).toBe("plan");
  });

  it("cycles effort from the latest queued value and wraps after max", () => {
    const efforts = ["default", "low", "medium", "high", "xhigh", "max"].map((id) => ({
      id,
      name: id === "xhigh" ? "XHigh" : id[0]!.toLocaleUpperCase() + id.slice(1),
      description: null
    }));

    expect(nextMakerEffort(efforts, "high")?.id).toBe("xhigh");
    expect(nextMakerEffort(efforts, "xhigh")?.id).toBe("max");
    expect(nextMakerEffort(efforts, "max")?.id).toBe("default");
    expect(nextMakerEffort(efforts, "low", "max")?.id).toBe("max");

    const effortsWithoutMax = efforts.filter((effort) => effort.id !== "max");
    expect(nextMakerEffort(effortsWithoutMax, "xhigh")?.id).toBe("default");
  });

  it("recovers current context usage from Claude's transcript when ACP omits it", () => {
    const usage = latestClaudeTranscriptUsage([
      JSON.stringify({ type: "assistant", isSidechain: false, message: { model: "claude-opus-5", usage: { input_tokens: 2, output_tokens: 400, cache_read_input_tokens: 100_000, cache_creation_input_tokens: 2_000 } } }),
      "{partial",
      JSON.stringify({ type: "assistant", isSidechain: false, message: { model: "claude-opus-5", usage: { input_tokens: 1, output_tokens: 500, cache_read_input_tokens: 120_000, cache_creation_input_tokens: 3_000 } } })
    ].join("\n"));

    expect(usage).toEqual({
      model: "Claude Opus 5",
      inputTokens: 1,
      outputTokens: 500,
      cachedReadTokens: 120_000,
      cachedWriteTokens: 3_000,
      contextUsed: 123_501
    });
  });

  it("turns Claude edit payloads into a concise CC-style activity", () => {
    const activity = normalizeClaudeToolActivity({
      toolCallId: "edit-1",
      kind: "edit",
      title: "Edit src/app.ts",
      status: "completed",
      rawInput: {
        file_path: "C:\\work\\src\\app.ts",
        old_string: "a".repeat(5_000),
        new_string: "b".repeat(5_000)
      },
      rawOutput: "The file was updated successfully. (file state is current in your context)",
      locations: [
        { path: "C:\\work\\src\\app.ts", line: null },
        { path: "C:\\work\\src\\app.ts", line: null }
      ],
      content: [{
        type: "diff",
        path: "C:\\work\\src\\app.ts",
        oldText: "const value = 1;",
        newText: "const value = 2;"
      }],
      _meta: { claudeCode: { toolName: "Edit" } }
    });

    expect(activity.locations).toEqual(["C:\\work\\src\\app.ts"]);
    expect(activity.input).toBeNull();
    expect(activity.output).toBeNull();
    expect(activity.diffs).toHaveLength(1);
  });

  it("bounds large diff sides before they reach persistence or rendering", () => {
    const activity = normalizeClaudeToolActivity({
      toolCallId: "edit-large",
      kind: "edit",
      title: "Edit generated file",
      status: "completed",
      content: [{
        type: "diff",
        path: "C:\\work\\generated.ts",
        oldText: "a".repeat(90_000),
        newText: "b".repeat(90_000)
      }]
    });

    expect(activity.diffs?.[0]?.oldText?.length).toBeLessThan(33_000);
    expect(activity.diffs?.[0]?.newText.length).toBeLessThan(33_000);
    expect(activity.diffs?.[0]?.newText).toContain("middle of large diff omitted");
  });
});
