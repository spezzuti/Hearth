import { describe, expect, it } from "vitest";
import {
  RESULT_END,
  RESULT_START,
  appendExecutionResultProbe,
  executionInstructionPayload,
  executionResultRequest,
  parseExecutionResult
} from "../../src/core/execution-result";

describe("bounded Claude execution results", () => {
  it("requests explicit evidence without embedding a valid result in the prompt", () => {
    const request = executionResultRequest();
    expect(request).toContain(RESULT_START);
    expect(request).toContain(RESULT_END);
    expect(request).toContain("checks you actually ran");
    expect(parseExecutionResult(request)).toBeNull();
  });

  it("relays the multiline instruction as one bracketed paste and one final submit", () => {
    const payload = executionInstructionPayload("Change one thing.\r\nRun tests.\u0000");
    expect(payload.startsWith("\u001b[200~")).toBe(true);
    expect(payload.endsWith("\u001b[201~\r")).toBe(true);
    expect(payload).toContain("Change one thing.\nRun tests.");
    expect(payload).not.toContain("\u0000");
    expect(payload).toContain(RESULT_START);
  });

  it("parses a result split across sanitized terminal chunks", () => {
    let probe = appendExecutionResultProbe("", `\u001b[32m${RESULT_START}\u001b[0m\n`);
    probe = appendExecutionResultProbe(
      probe,
      JSON.stringify({
        changedFiles: ["src/app.ts"],
        validation: ["npm test — passed"],
        concerns: ["Packaging was not run"],
        decision: "Approve packaging?"
      }).slice(0, 45)
    );
    probe = appendExecutionResultProbe(
      probe,
      `${JSON.stringify({
        changedFiles: ["src/app.ts"],
        validation: ["npm test — passed"],
        concerns: ["Packaging was not run"],
        decision: "Approve packaging?"
      }).slice(45)}\n${RESULT_END}`
    );

    expect(parseExecutionResult(probe)).toEqual({
      changedFiles: ["src/app.ts"],
      validation: ["npm test — passed"],
      concerns: ["Packaging was not run"],
      decision: "Approve packaging?",
      corroboration: null
    });
  });

  it("ignores an echoed malformed marker request and uses the latest valid report", () => {
    const probe = [
      RESULT_START,
      "describe the JSON here",
      RESULT_END,
      RESULT_START,
      JSON.stringify({
        changedFiles: [],
        validation: [],
        concerns: [],
        decision: ""
      }),
      RESULT_END
    ].join("\n");
    expect(parseExecutionResult(probe)).toEqual({
      changedFiles: [],
      validation: [],
      concerns: [],
      decision: "",
      corroboration: null
    });
  });
});
