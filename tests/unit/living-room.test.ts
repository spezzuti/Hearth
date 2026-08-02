import { describe, expect, it } from "vitest";
import { livingRoomTurnPlan } from "../../src/core/living-room";
import { codexSessionKey } from "../../src/core/codex-acp-runtime";

describe("Living Room orchestration", () => {
  it("calls exactly one selected resident for an ordinary conversation", () => {
    expect(livingRoomTurnPlan("conversation", ["librarian", "maker"])).toMatchObject([
      { agent: "librarian", status: "Thinking it through…" }
    ]);
  });

  it("keeps a roundtable in visible selection order without duplicate turns", () => {
    expect(
      livingRoomTurnPlan("roundtable", ["critic", "maker", "critic", "companion"])
        .map((turn) => turn.agent)
    ).toEqual(["critic", "maker", "companion"]);
  });

  it("runs a bounded adversarial pressure test with optional Library evidence", () => {
    expect(
      livingRoomTurnPlan("challenge", ["librarian"]).map((turn) => turn.agent)
    ).toEqual(["maker", "critic", "librarian", "companion"]);
    expect(
      livingRoomTurnPlan("challenge", []).map((turn) => turn.agent)
    ).toEqual(["maker", "critic", "companion"]);
    expect(livingRoomTurnPlan("challenge", [])[1]?.status).toBe(
      "Looking for the weak spot…"
    );
  });

  it("namespaces Codex sessions so Study and Living Room cannot share history", () => {
    const study = codexSessionKey("C:\\Projects\\Hearth", "resident");
    const living = codexSessionKey(
      "C:\\Projects\\Hearth",
      "living:thread-one:critic"
    );
    expect(study).not.toBe(living);
    expect(living).toContain("living:thread-one:critic");
  });
});
