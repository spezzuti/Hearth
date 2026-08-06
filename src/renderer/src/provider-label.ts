import type { ResidentProviderStatus } from "../../shared/contracts";

function withoutClaudePrefix(value: string): string {
  return value.replace(/^Claude\s+/i, "");
}

export function residentProviderLabel(resident: ResidentProviderStatus): string {
  if (resident.provider === "local") return resident.name;

  let label: string;
  if (resident.modelSource === "configured") {
    const model = withoutClaudePrefix(resident.model ?? "model");
    label = resident.provider === "claude-code"
      ? `Claude configured ${model}`
      : `Configured ${model}`;
  } else if (resident.modelSource === "unreported") {
    label = resident.provider === "codex" ? "Codex" : "Claude model not reported";
  } else {
    label = resident.model ?? resident.name;
  }

  return resident.fallbackFrom ? `${label} · fallback` : label;
}
