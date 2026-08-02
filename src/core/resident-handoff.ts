import type {
  MakerProposal,
  ResidentConsultation
} from "../shared/contracts";

export interface CriticConsultationDecision {
  phase: ResidentConsultation["phase"];
  reason: ResidentConsultation["reason"];
  note: string;
}

export function criticConsultationDecision(
  proposal: MakerProposal
): CriticConsultationDecision | null {
  if (
    proposal.consultations.some((consultation) =>
      consultation.phase === (proposal.executionResult ? "postflight" : "preflight")
    )
  ) {
    return null;
  }

  if (!proposal.executionResult) {
    if (proposal.risk === "high") {
      return {
        phase: "preflight",
        reason: "high-risk",
        note: "Maker asked Critic to pressure-test this before it reaches Claude Code."
      };
    }
    if (proposal.risk === "unknown") {
      return {
        phase: "preflight",
        reason: "unknown-risk",
        note: "Maker asked Critic to look at the uncertainty before this reaches Claude Code."
      };
    }
    return null;
  }

  const corroboration = proposal.executionResult.corroboration;
  if (corroboration?.status === "mismatch") {
    return {
      phase: "postflight",
      reason: "evidence-mismatch",
      note: "Maker brought Critic in because Claude Code’s report and the working tree disagree."
    };
  }
  if (corroboration?.status === "partial") {
    return {
      phase: "postflight",
      reason: "evidence-partial",
      note: "Maker brought Critic in because the execution report only partly matches the working tree."
    };
  }
  if (proposal.executionResult.concerns.length > 0) {
    return {
      phase: "postflight",
      reason: "reported-concerns",
      note: "Maker brought Critic in because Claude Code reported an unresolved concern."
    };
  }
  return null;
}
