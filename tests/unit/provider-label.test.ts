import { describe, expect, it } from "vitest";
import { residentProviderLabel } from "../../src/renderer/src/provider-label";
import type { ResidentProviderStatus } from "../../src/shared/contracts";

function resident(
  overrides: Partial<ResidentProviderStatus> = {}
): ResidentProviderStatus {
  return {
    provider: "claude-code",
    name: "Claude Code",
    model: "Opus",
    modelSource: "configured",
    available: true,
    state: "ready",
    detail: "Available",
    fallbackFrom: null,
    lastError: null,
    lastUsedAt: null,
    ...overrides
  };
}

describe("provider identity labels", () => {
  it("distinguishes configured identity from a model reported by the provider", () => {
    expect(residentProviderLabel(resident())).toBe("Claude configured Opus");
    expect(
      residentProviderLabel(
        resident({ model: "Claude Opus 5", modelSource: "reported" })
      )
    ).toBe("Claude Opus 5");
  });

  it("does not invent an underlying Codex model", () => {
    expect(
      residentProviderLabel(
        resident({
          provider: "codex",
          name: "Codex via ACP",
          model: null,
          modelSource: "unreported"
        })
      )
    ).toBe("Codex");
  });

  it("keeps fallback provenance visible", () => {
    expect(
      residentProviderLabel(
        resident({ model: "Fable", fallbackFrom: "codex" })
      )
    ).toBe("Claude configured Fable · fallback");
  });
});
