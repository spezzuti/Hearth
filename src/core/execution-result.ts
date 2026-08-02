import type { MakerExecutionResult } from "../shared/contracts";
import { cleanTerminalText } from "./terminal-observation";

export const RESULT_START = "HEARTH_RESULT_START";
export const RESULT_END = "HEARTH_RESULT_END";

const MAX_RESULT_PROBE = 64 * 1024;

function boundedStrings(value: unknown, limit: number, length: number): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim().slice(0, length))
    .filter(Boolean)
    .slice(0, limit);
}

export function executionResultRequest(): string {
  return [
    "",
    "When this approved work is finished, report back to Hearth.",
    `Print ${RESULT_START} on its own line.`,
    "On the next line print only one JSON object with these keys:",
    "- changedFiles: an array of paths you actually changed",
    "- validation: an array of checks you actually ran and their outcomes",
    "- concerns: an array of unresolved risks, failures, or unknowns",
    "- decision: the exact decision or next action needed from the user, or an empty string",
    "Do not use markdown fences and do not claim checks you did not run.",
    `Print ${RESULT_END} on its own line after the JSON object.`
  ].join("\n");
}

export function executionInstructionPayload(text: string): string {
  const instruction = `${text}${executionResultRequest()}`
    .replaceAll("\r\n", "\n")
    .replaceAll("\r", "\n")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "");
  return `\u001b[200~${instruction}\u001b[201~\r`;
}

export function appendExecutionResultProbe(probe: string, data: string): string {
  return cleanTerminalText(`${probe}${data}`).slice(-MAX_RESULT_PROBE);
}

export function parseExecutionResult(probe: string): MakerExecutionResult | null {
  let searchFrom = probe.length;
  while (searchFrom >= 0) {
    const start = probe.lastIndexOf(RESULT_START, searchFrom);
    if (start < 0) {
      return null;
    }
    const jsonStart = start + RESULT_START.length;
    const end = probe.indexOf(RESULT_END, jsonStart);
    if (end < 0) {
      searchFrom = start - 1;
      continue;
    }
    const payload = probe.slice(jsonStart, end).trim();
    try {
      const parsed = JSON.parse(payload) as Record<string, unknown>;
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error("Execution result is not an object.");
      }
      return {
        changedFiles: boundedStrings(parsed.changedFiles, 24, 500),
        validation: boundedStrings(parsed.validation, 16, 1_000),
        concerns: boundedStrings(parsed.concerns, 16, 1_000),
        decision:
          typeof parsed.decision === "string"
            ? parsed.decision.trim().slice(0, 2_000)
            : "",
        corroboration: null
      };
    } catch {
      searchFrom = start - 1;
    }
  }
  return null;
}
