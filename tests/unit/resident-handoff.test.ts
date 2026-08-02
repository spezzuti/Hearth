import { describe, expect, it } from "vitest";
import type { MakerProposal } from "../../src/shared/contracts";
import { criticConsultationDecision } from "../../src/core/resident-handoff";

function proposal(
  patch: Partial<MakerProposal> = {}
): MakerProposal {
  return {
    id: "proposal-1",
    sourceMessageId: "message-1",
    workspaceProjectId: "workspace-hearth",
    rootPath: "C:\\Projects\\Hearth",
    projectName: "Hearth",
    contextKind: "project",
    contextPath: null,
    instruction: "Keep the next change bounded.",
    rationale: "The core workflow needs one focused improvement.",
    expectedFiles: ["src/core/core.ts"],
    risk: "low",
    riskSummary: "No unusual risk identified.",
    consultations: [],
    status: "draft",
    executionResult: null,
    createdAt: "2026-07-30T12:00:00.000Z",
    updatedAt: "2026-07-30T12:00:00.000Z",
    passedAt: null,
    resultAt: null,
    ...patch
  };
}

describe("resident handoff policy", () => {
  it("keeps ordinary low and medium risk proposals quiet", () => {
    expect(criticConsultationDecision(proposal())).toBeNull();
    expect(
      criticConsultationDecision(proposal({ risk: "medium" }))
    ).toBeNull();
  });

  it("brings Critic into high and unknown risk proposals before execution", () => {
    expect(
      criticConsultationDecision(proposal({ risk: "high" }))
    ).toMatchObject({
      phase: "preflight",
      reason: "high-risk"
    });
    expect(
      criticConsultationDecision(proposal({ risk: "unknown" }))
    ).toMatchObject({
      phase: "preflight",
      reason: "unknown-risk"
    });
  });

  it("prioritizes mismatched or partial evidence after execution", () => {
    const executionResult = {
      changedFiles: ["src/core/core.ts"],
      validation: ["npm test passed"],
      concerns: ["One concern"],
      decision: "",
      corroboration: {
        status: "mismatch" as const,
        observedFiles: [],
        matchedFiles: [],
        missingReportedFiles: ["src/core/core.ts"],
        additionalObservedFiles: [],
        checkedAt: "2026-07-30T12:01:00.000Z"
      }
    };
    expect(
      criticConsultationDecision(
        proposal({ status: "passed", executionResult })
      )
    ).toMatchObject({
      phase: "postflight",
      reason: "evidence-mismatch"
    });
    expect(
      criticConsultationDecision(
        proposal({
          status: "passed",
          executionResult: {
            ...executionResult,
            corroboration: {
              ...executionResult.corroboration,
              status: "partial"
            }
          }
        })
      )
    ).toMatchObject({
      phase: "postflight",
      reason: "evidence-partial"
    });
  });

  it("uses reported concerns when evidence matches and never duplicates a phase", () => {
    const withConcern = proposal({
      status: "passed",
      executionResult: {
        changedFiles: ["src/core/core.ts"],
        validation: ["npm test passed"],
        concerns: ["Installer smoke has not run."],
        decision: "",
        corroboration: {
          status: "matched",
          observedFiles: ["src/core/core.ts"],
          matchedFiles: ["src/core/core.ts"],
          missingReportedFiles: [],
          additionalObservedFiles: [],
          checkedAt: "2026-07-30T12:01:00.000Z"
        }
      }
    });
    expect(criticConsultationDecision(withConcern)).toMatchObject({
      phase: "postflight",
      reason: "reported-concerns"
    });
    expect(
      criticConsultationDecision({
        ...withConcern,
        consultations: [
          {
            id: "consultation-1",
            from: "maker",
            to: "critic",
            phase: "postflight",
            reason: "reported-concerns",
            note: "Already sent.",
            createdAt: "2026-07-30T12:02:00.000Z"
          }
        ]
      })
    ).toBeNull();
  });
});
