import { afterEach, describe, expect, it } from "vitest";
import { CompanionServer } from "../../src/main/companion-server";
import type {
  ArchiveSnapshot,
  BootstrapData,
  CoreMethod
} from "../../src/shared/contracts";

const running: CompanionServer[] = [];

afterEach(async () => {
  await Promise.all(running.splice(0).map((server) => server.stop()));
});

function fixtureBootstrap(): BootstrapData {
  return {
    workspace: {
      selectedProject: {
        id: "workspace-hearth",
        name: "Hearth",
        rootPath: "C:\\Projects\\Hearth",
        signals: ["git", "hearth"],
        branch: "main",
        lastTouchedAt: "2026-07-29T17:00:00.000Z",
        selected: true
      }
    },
    returnPack: {
      id: "return-1",
      whereYouLeftOff: "Reviewing the local Companion boundary.",
      sessionState: "Workshop is waiting for input.",
      lastApprovedAction: "Keep remote access read-mostly.",
      changedWork: "A loopback service.",
      waitingOnYou: "Nothing.",
      recommendedNextAction: "Pair locally and inspect the phone surface.",
      restartQuestion: "Nothing needs restarting.",
      createdAt: "2026-07-29T17:00:00.000Z"
    },
    terminal: {
      observation: {
        state: "attention",
        summary: "Workshop is waiting for input.",
        requiresInput: true,
        updatedAt: "2026-07-29T17:00:00.000Z"
      }
    },
    runtime: {
      provider: {
        selection: "local",
        active: "local",
        available: true,
        state: "local",
        name: "Hearth local",
        models: {
          maker: null,
          companion: null,
          critic: null,
          librarian: null
        },
        detail: "Fast, private personality responses",
        lastError: null,
        lastUsedAt: null
      }
    },
    captures: [
      {
        id: "capture-1",
        kind: "idea",
        text: "A smaller remote Hearth.",
        title: null,
        projectName: "Hearth",
        archived: false,
        ideaState: "resting",
        createdAt: "2026-07-29T17:00:00.000Z"
      }
    ],
    makerProposal: {
      id: "proposal-1",
      sourceMessageId: "message-maker-1",
      workspaceProjectId: "workspace-hearth",
      rootPath: "C:\\Projects\\Hearth",
      projectName: "Hearth",
      contextKind: "project",
      contextPath: null,
      instruction: "Tighten the Companion decision boundary.",
      rationale: "Keep reversible choices close without turning the phone into a remote terminal.",
      expectedFiles: ["src/main/companion-server.ts"],
      risk: "low",
      riskSummary: "The phone remains bounded.",
      status: "completed",
      executionResult: {
        changedFiles: ["src/main/companion-server.ts"],
        validation: ["npm test"],
        concerns: [],
        decision: "Ready for a calm review.",
        corroboration: {
          status: "matched",
          observedFiles: ["src/main/companion-server.ts"],
          matchedFiles: ["src/main/companion-server.ts"],
          missingReportedFiles: [],
          additionalObservedFiles: [],
          checkedAt: "2026-07-29T17:00:00.000Z"
        }
      },
      createdAt: "2026-07-29T17:00:00.000Z",
      updatedAt: "2026-07-29T17:00:00.000Z",
      passedAt: "2026-07-29T17:00:00.000Z",
      resultAt: "2026-07-29T17:00:00.000Z"
    },
    conversations: {
      companion: [
        {
          id: "message-1",
          agent: "companion",
          role: "assistant",
          text: "I’m here.",
          createdAt: "2026-07-29T17:00:00.000Z"
        }
      ]
    }
  } as unknown as BootstrapData;
}

function fixtureArchive(): ArchiveSnapshot {
  return {
    items: [
      {
        id: "handoff-1",
        kind: "handoff",
        title: "Review the Companion boundary.",
        summary: "Closed without terminal control.",
        status: "Completed",
        projectId: "workspace-hearth",
        projectName: "Hearth",
        path: null,
        details: [],
        action: null,
        returnPack: null,
        removal: {
          removesFile: false,
          consequence: "This record will be deleted."
        },
        createdAt: "2026-07-29T17:00:00.000Z"
      }
    ],
    counts: {
      "return-pack": 0,
      library: 0,
      idea: 0,
      handoff: 1,
      edit: 0
    },
    generatedAt: "2026-07-29T17:00:00.000Z"
  };
}

describe("CompanionServer", () => {
  it("stays loopback-only, pairs explicitly, and exposes only bounded capabilities", async () => {
    const calls: Array<{ method: CoreMethod; payload: unknown }> = [];
    const server = new CompanionServer(async (method, payload) => {
      calls.push({ method, payload });
      if (method === "bootstrap") return fixtureBootstrap();
      if (method === "getArchive") return fixtureArchive();
      if (method === "saveCapture") {
        return { capture: { id: "new-capture" }, duplicate: false };
      }
      if (method === "updateCapture") {
        return {
          id: "capture-1",
          kind: "idea",
          ideaState: (payload as { patch: { ideaState: string } }).patch.ideaState
        };
      }
      if (method === "sendAgentMessage") {
        return { messages: [], cancelled: false };
      }
      throw new Error(`Unexpected method ${method}`);
    }, 0);
    running.push(server);

    expect(server.status()).toMatchObject({ enabled: false, state: "off" });
    const started = await server.start();
    expect(started).toMatchObject({
      enabled: true,
      state: "ready"
    });
    expect(started.localUrl).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);
    expect(started.pairingCode).toMatch(/^\d{6}$/);

    const unauthorized = await fetch(`${started.localUrl}/api/snapshot`);
    expect(unauthorized.status).toBe(401);
    const pairPage = await fetch(started.localUrl!);
    expect(await pairPage.text()).toContain("Pair this screen");

    const wrong = await fetch(`${started.localUrl}/pair`, {
      method: "POST",
      body: JSON.stringify({ code: "000000" })
    });
    expect(wrong.status).toBe(401);
    for (let attempt = 0; attempt < 4; attempt += 1) {
      await fetch(`${started.localUrl}/pair`, {
        method: "POST",
        body: JSON.stringify({ code: "000000" })
      });
    }
    const throttled = await fetch(`${started.localUrl}/pair`, {
      method: "POST",
      body: JSON.stringify({ code: started.pairingCode })
    });
    expect(throttled.status).toBe(429);
    const refreshed = server.rotate();

    const paired = await fetch(`${started.localUrl}/pair`, {
      method: "POST",
      body: JSON.stringify({ code: refreshed.pairingCode })
    });
    expect(paired.status).toBe(200);
    const cookie = paired.headers.get("set-cookie")?.split(";")[0];
    expect(cookie).toMatch(/^hearth_companion=/);

    const snapshotResponse = await fetch(`${started.localUrl}/api/snapshot`, {
      headers: { Cookie: cookie! }
    });
    const snapshot = await snapshotResponse.json();
    expect(snapshot).toMatchObject({
      project: { name: "Hearth" },
      workshop: {
        summary: "Workshop is waiting for input.",
        requiresInput: true
      },
      provider: {
        active: "local",
        model: null
      },
      decisions: {
        ideas: [
          {
            id: "capture-1",
            ideaState: "resting"
          }
        ],
        handoff: {
          kind: "Execution report",
          status: "Ready to review",
          summary: "Ready for a calm review."
        }
      }
    });
    const snapshotText = JSON.stringify(snapshot);
    expect(snapshotText).not.toContain("scrollback");
    expect(snapshotText).not.toContain("rootPath");
    expect(snapshotText).not.toContain("expectedFiles");
    expect(snapshotText).not.toContain("changedFiles");
    expect(snapshotText).not.toContain("src/main/companion-server.ts");

    const capture = await fetch(`${started.localUrl}/api/capture`, {
      method: "POST",
      headers: {
        Cookie: cookie!,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ kind: "idea", text: "Keep this remotely." })
    });
    expect(capture.status).toBe(200);
    expect(calls.at(-1)).toEqual({
      method: "saveCapture",
      payload: { kind: "idea", text: "Keep this remotely." }
    });

    const automaticCapture = await fetch(`${started.localUrl}/api/capture`, {
      method: "POST",
      headers: {
        Cookie: cookie!,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        kind: "auto",
        text: "@note #mobile Check this when I get home."
      })
    });
    expect(automaticCapture.status).toBe(200);
    expect(calls.at(-1)).toEqual({
      method: "saveCapture",
      payload: { text: "@note #mobile Check this when I get home." }
    });

    const remoteLink = await fetch(`${started.localUrl}/api/capture`, {
      method: "POST",
      headers: {
        Cookie: cookie!,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        kind: "link",
        text: "https://example.com/from-phone"
      })
    });
    expect(remoteLink.status).toBe(200);
    expect(calls.at(-1)).toEqual({
      method: "saveCapture",
      payload: {
        kind: "link",
        text: "https://example.com/from-phone"
      }
    });

    const ideaDecision = await fetch(`${started.localUrl}/api/idea-state`, {
      method: "POST",
      headers: {
        Cookie: cookie!,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ captureId: "capture-1", state: "pursuing" })
    });
    expect(ideaDecision.status).toBe(200);
    expect(calls.at(-1)).toEqual({
      method: "updateCapture",
      payload: {
        captureId: "capture-1",
        patch: { ideaState: "pursuing" }
      }
    });

    const invalidDecision = await fetch(`${started.localUrl}/api/idea-state`, {
      method: "POST",
      headers: {
        Cookie: cookie!,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ captureId: "capture-1", state: "execute" })
    });
    expect(invalidDecision.status).toBe(400);

    for (const forbiddenPath of [
      "/api/terminal",
      "/api/proposal/approve",
      "/api/files",
      "/api/apply"
    ]) {
      const forbidden = await fetch(`${started.localUrl}${forbiddenPath}`, {
        method: "POST",
        headers: {
          Cookie: cookie!,
          "Content-Type": "application/json"
        },
        body: "{}"
      });
      expect(forbidden.status).toBe(404);
    }

    server.rotate();
    const revoked = await fetch(`${started.localUrl}/api/snapshot`, {
      headers: { Cookie: cookie! }
    });
    expect(revoked.status).toBe(401);

    const secureCode = server.rotate().pairingCode;
    const securePair = await fetch(`${started.localUrl}/pair`, {
      method: "POST",
      headers: { "Tailscale-User-Login": "owner@example.com" },
      body: JSON.stringify({ code: secureCode })
    });
    expect(securePair.headers.get("set-cookie")).toContain("Secure");
  });
});
