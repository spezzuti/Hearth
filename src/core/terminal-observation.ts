import path from "node:path";
import type {
  TerminalKind,
  TerminalObservation,
  TerminalObservationState
} from "../shared/contracts";

const ANSI_SEQUENCE =
  /[\u001b\u009b][[\]()#;?]*(?:(?:(?:[a-zA-Z\d]*(?:;[-a-zA-Z\d/#&.:=?%@~_]+)*)?\u0007)|(?:(?:\d{1,4}(?:[;:]\d{0,4})*)?[\dA-PR-TZcf-nq-uy=><~]))/g;
const OSC_SEQUENCE = /\u001b\][^\u0007]*(?:\u0007|\u001b\\)/g;
const CONTROL_CHARACTER = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g;
const MAX_TERMINAL_VIEW_LINES = 120;
const MAX_TERMINAL_VIEW_CHARACTERS = 16_000;

export function sameTerminalRoot(left: string | null | undefined, right: string | null | undefined): boolean {
  if (!left || !right) return false;
  return path.resolve(left).replace(/[\\/]+$/, "").toLocaleLowerCase() ===
    path.resolve(right).replace(/[\\/]+$/, "").toLocaleLowerCase();
}

export function cleanTerminalText(value: string): string {
  return value
    .replaceAll(OSC_SEQUENCE, "")
    .replaceAll(ANSI_SEQUENCE, "")
    .replaceAll("\r", "")
    .replaceAll(CONTROL_CHARACTER, "");
}

export function boundedTerminalView(value: string): string | null {
  const redacted = cleanTerminalText(value)
    .replace(/<\/?terminal_view>/gi, "[terminal-view-marker]")
    .replace(
      /\b(authorization\s*:\s*)(?:bearer|basic)\s+\S+/gi,
      "$1[REDACTED]"
    )
    .replace(
      /\b((?:api[_-]?key|access[_-]?token|auth(?:orization)?|password|secret|token)\s*[:=]\s*)(?:"[^"]*"|'[^']*'|[^\s]+)/gi,
      "$1[REDACTED]"
    )
    .replace(
      /\b(?:sk-(?:proj-)?|gh[pousr]_|github_pat_|xox[baprs]-|AIza)[A-Za-z0-9_-]{12,}\b/g,
      "[REDACTED]"
    );
  const lines: string[] = [];
  let previousBlank = false;
  for (const rawLine of redacted.split("\n")) {
    const line = rawLine.trimEnd().slice(-1_000);
    const blank = !line.trim();
    if (blank && previousBlank) continue;
    lines.push(line);
    previousBlank = blank;
  }
  const recent = lines.slice(-MAX_TERMINAL_VIEW_LINES).join("\n").trim();
  if (!recent) return null;
  return recent.slice(-MAX_TERMINAL_VIEW_CHARACTERS);
}

function observationState(
  text: string,
  kind: TerminalKind
): { state: TerminalObservationState; requiresInput: boolean } {
  if (
    /no conversation found with session id/i.test(text) ||
    /(?:^|\n)\s*(?:fatal|error):\s+\S/im.test(text) ||
    /unhandled (?:exception|rejection)/i.test(text)
  ) {
    return { state: "failed", requiresInput: false };
  }
  if (
    /\b(?:do you want to|would you like to|are you sure)\b[^\n?]*\?/i.test(text) ||
    /\((?:y\/n|yes\/no)\)/i.test(text) ||
    /\bpress enter\b/i.test(text) ||
    /\b(?:allow|approve|confirm)\b[^\n?]*\?/i.test(text)
  ) {
    return { state: "attention", requiresInput: true };
  }
  if (/(?:^|\n)PS [^\n>]+>\s*$/i.test(text)) {
    return { state: "ready", requiresInput: false };
  }
  if (kind === "claude" && /\b(?:esc to interrupt|thinking|working)\b/i.test(text)) {
    return { state: "working", requiresInput: false };
  }
  return { state: "working", requiresInput: false };
}

function claudeModeSummary(text: string): string | null {
  const matches = [...text.matchAll(/\b(manual|auto|plan)\s+mode(?:\s+on)?\b/gi)];
  const mode = matches.at(-1)?.[1];
  if (!mode) {
    return null;
  }
  return `${mode[0]?.toUpperCase() ?? ""}${mode.slice(1).toLowerCase()} mode`;
}

function observationSummary(
  lines: string[],
  text: string,
  kind: TerminalKind,
  state: TerminalObservationState
): string {
  const lastLine = lines.at(-1) ?? "The process is producing output.";
  if (kind !== "claude" || state === "attention" || state === "failed") {
    return lastLine.slice(-240);
  }

  return (
    claudeModeSummary(text) ??
    (state === "ready" ? "Waiting at the prompt" : "Active in terminal")
  );
}

export function observeTerminalText(
  probe: string,
  data: string,
  kind: TerminalKind,
  updatedAt: string
): { probe: string; observation: TerminalObservation } {
  const nextProbe = cleanTerminalText(`${probe}${data}`).slice(-4_000);
  const lines = nextProbe
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const status = observationState(nextProbe, kind);
  const summary = observationSummary(lines, nextProbe, kind, status.state);
  return {
    probe: nextProbe,
    observation: {
      state: status.state,
      summary,
      requiresInput: status.requiresInput,
      updatedAt
    }
  };
}
