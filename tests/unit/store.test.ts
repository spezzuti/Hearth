import { access, mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterEach, describe, expect, it } from "vitest";
import { HearthStore } from "../../src/core/store";
import type { TerminalSession } from "../../src/shared/contracts";

const cleanup: string[] = [];

afterEach(async () => {
  while (cleanup.length > 0) {
    const target = cleanup.pop();
    if (target) {
      await rm(target, { recursive: true, force: true });
    }
  }
});

describe("HearthStore continuity contract", () => {
  it("persists shared Living Room discussions without leaking them across projects", async () => {
    const dataDirectory = await mkdtemp(path.join(os.tmpdir(), "hearth-living-room-"));
    cleanup.push(dataDirectory);
    const store = await HearthStore.open(dataDirectory, "C:\\Projects\\Hearth");
    const hearth = { id: "workspace-hearth", name: "Hearth" };
    const revive = { id: "workspace-revive", name: "Revive" };

    let hearthRoom = store.createLivingRoomDiscussion(
      "roundtable",
      ["maker", "critic"],
      true,
      hearth,
      {
        kind: "workshop",
        label: "Hearth · Workshop",
        summary: "The latest managed turn was interrupted before validation.",
        sourceId: "turn-one"
      }
    );
    const hearthThread = hearthRoom.threads[0]!;
    const user = store.appendLivingRoomUserMessage(
      hearthThread.id,
      "Should we keep this architecture?",
      "roundtable",
      ["maker", "critic"],
      true,
      hearth
    );
    store.appendLivingRoomResidentMessage(
      hearthThread.id,
      "maker",
      "Keep it narrow and prove the handoff first.",
      user.round
    );
    store.createLivingRoomDiscussion(
      "conversation",
      ["companion"],
      false,
      revive
    );

    hearthRoom = store.getLivingRoom(hearth.id);
    const reviveRoom = store.getLivingRoom(revive.id);
    expect(hearthRoom.threads).toHaveLength(1);
    expect(hearthRoom.archivedThreads).toHaveLength(0);
    expect(hearthRoom.threads[0]?.context).toMatchObject({
      kind: "workshop",
      sourceId: "turn-one"
    });
    expect(hearthRoom.threads[0]?.messages.map((message) => message.text)).toEqual([
      "Should we keep this architecture?",
      "Keep it narrow and prove the handoff first."
    ]);
    expect(reviveRoom.threads).toHaveLength(1);
    expect(reviveRoom.threads[0]?.projectName).toBe("Revive");
    expect(
      store.getBootstrap(undefined, {
        workspaceProjectId: revive.id,
        rootPath: "C:\\Projects\\Revive"
      }).livingRoom.threads
    ).toHaveLength(1);

    store.close();
    const reopened = await HearthStore.open(dataDirectory, "C:\\Projects\\Hearth");
    expect(reopened.getLivingRoom(hearth.id).threads[0]?.messages).toHaveLength(2);
    const renamed = reopened.renameLivingRoomDiscussion(
      hearthThread.id,
      "Architecture decision",
      hearth.id
    );
    expect(renamed.threads[0]?.title).toBe("Architecture decision");
    let archived = reopened.archiveLivingRoomDiscussion(
      hearthThread.id,
      hearth.id
    );
    expect(archived.threads).toHaveLength(0);
    expect(archived.archivedThreads[0]?.title).toBe("Architecture decision");
    const restored = reopened.restoreLivingRoomDiscussion(
      hearthThread.id,
      hearth.id
    );
    expect(restored.threads[0]?.context?.label).toBe("Hearth · Workshop");
    archived = reopened.archiveLivingRoomDiscussion(hearthThread.id, hearth.id);
    expect(archived.archivedThreads).toHaveLength(1);
    expect(reopened.getLivingRoom(revive.id).threads).toHaveLength(1);
    reopened.close();
  });

  it("keeps House Memory visible, scoped, correctable, and forgettable", async () => {
    const dataDirectory = await mkdtemp(path.join(os.tmpdir(), "hearth-memory-"));
    cleanup.push(dataDirectory);
    const store = await HearthStore.open(dataDirectory, "C:\\Projects\\Hearth");

    let snapshot = store.saveHouseMemory({
      kind: "preference",
      scope: "house",
      text: "Keep return summaries short and recommend one next action."
    });
    const globalMemory = snapshot.active[0]!;
    snapshot = store.saveHouseMemory({
      kind: "project",
      scope: "project",
      subjectId: "workspace-hearth",
      subjectLabel: "Hearth",
      text: "Treat visual comfort as part of correctness."
    });
    snapshot = store.saveHouseMemory({
      kind: "resident",
      scope: "resident",
      subjectId: "maker",
      subjectLabel: "Maker",
      text: "Work discussion should stay capable, casual, and natural."
    });
    const residentMemory = snapshot.active.find(
      (memory) => memory.scope === "resident"
    )!;

    expect(
      store.getHouseMemoryEvidence("maker", "workspace-hearth")
    ).toContain("visual comfort");
    expect(
      store.getHouseMemoryEvidence("maker", "workspace-hearth")
    ).toContain("capable, casual");
    expect(
      store.getHouseMemoryEvidence("critic", "workspace-hearth")
    ).not.toContain("capable, casual");
    expect(store.getResidentSocialMemory("maker")).toContain(
      "capable, casual"
    );
    expect(store.getResidentSocialMemory("critic")).toBeNull();
    expect(
      store.getHouseMemoryEvidence("critic", "workspace-other")
    ).not.toContain("visual comfort");

    snapshot = store.updateHouseMemory(residentMemory.id, {
      text: "Keep Maker capable, casual, natural, and willing to disagree."
    });
    expect(
      snapshot.active.find((memory) => memory.id === residentMemory.id)?.text
    ).toContain("willing to disagree");

    for (let index = 0; index < 3; index += 1) {
      const timestamp = new Date(Date.UTC(2026, 6, 30, 12, index)).toISOString();
      store.saveTerminalSession({
        id: `00000000-0000-4000-8000-00000000000${index}`,
        projectId: "project-hearth",
        cwd: "C:\\Projects\\Hearth",
        pid: null,
        kind: "claude",
        owner: "user",
        lifecycle: "stopped",
        startedAt: timestamp,
        lastActivityAt: timestamp,
        exitedAt: timestamp,
        exitCode: 0,
        claudeSessionId: null,
        claudeName: null,
        claudeResumable: false,
        cols: 120,
        rows: 30
      });
    }
    snapshot = store.getHouseMemorySnapshot();
    expect(snapshot.suggested.map((memory) => memory.text)).toEqual(
      expect.arrayContaining([
        "Claude Code is your usual Workshop session.",
        "Hearth is a project you regularly return to."
      ])
    );
    const observed = snapshot.suggested.find(
      (memory) => memory.kind === "tool"
    )!;
    snapshot = store.updateHouseMemory(observed.id, { state: "active" });
    expect(snapshot.active.find((memory) => memory.id === observed.id)?.source).toBe(
      "observed"
    );
    expect(store.getHouseMemoryEvidence("companion")).toContain(
      "Claude Code is your usual Workshop session"
    );
    snapshot = store.forgetHouseMemory(observed.id);
    expect(snapshot.active.some((memory) => memory.id === observed.id)).toBe(false);
    expect(snapshot.suggested.some((memory) => memory.id === observed.id)).toBe(false);

    const remainingSuggestion = snapshot.suggested[0]!;
    snapshot = store.updateHouseMemory(remainingSuggestion.id, {
      state: "dismissed"
    });
    expect(snapshot.suggested).toHaveLength(0);
    snapshot = store.forgetHouseMemory(globalMemory.id);
    expect(snapshot.active.some((memory) => memory.id === globalMemory.id)).toBe(
      false
    );
    store.close();

    const reopened = await HearthStore.open(
      dataDirectory,
      "C:\\Projects\\Hearth"
    );
    const restored = reopened.getHouseMemorySnapshot();
    expect(restored.suggested).toHaveLength(0);
    expect(restored.dismissedCount).toBe(2);
    expect(restored.dismissed).toHaveLength(2);
    expect(restored.active.some((memory) => memory.id === residentMemory.id)).toBe(
      true
    );
    reopened.close();
  });

  it("persists quiet Windows attention preferences", async () => {
    const dataDirectory = await mkdtemp(path.join(os.tmpdir(), "hearth-notifications-"));
    cleanup.push(dataDirectory);

    const store = await HearthStore.open(dataDirectory, "C:\\Projects\\Hearth");
    expect(store.getNotificationPreferences()).toEqual({
      workshopAttention: true,
      residentReplies: true,
      phoneActivity: false
    });
    store.saveNotificationPreferences({
      workshopAttention: false,
      residentReplies: false,
      phoneActivity: true
    });
    store.close();

    const reopened = await HearthStore.open(dataDirectory, "C:\\Projects\\Hearth");
    expect(reopened.getBootstrap().notifications).toEqual({
      workshopAttention: false,
      residentReplies: false,
      phoneActivity: true
    });
    reopened.close();
  });

  it("persists conversation, objective, capture, and a truthful Return Pack", async () => {
    const dataDirectory = await mkdtemp(path.join(os.tmpdir(), "hearth-store-"));
    cleanup.push(dataDirectory);

    const store = await HearthStore.open(dataDirectory, "C:\\Projects\\Hearth");
    expect(store.journalMode.toLowerCase()).toBe("wal");

    const initial = store.getBootstrap();
    expect(initial.state.lastRoute).toBe("home");
    expect(initial.runtime.liveProcesses).toBe(0);
    expect(initial.returnPack.sessionState).toContain("No terminal");

    store.setRoute("study");
    store.updateObjective("Prove that reload and relaunch preserve the same project truth.");
    store.sendAgentMessage("maker", "How should we test the memory?");
    const { capture } = store.saveCapture("https://example.com/continuity");
    expect(capture.kind).toBe("link");

    const pack = store.leaveProject("We stopped after defining the relaunch proof.");
    expect(pack.whereYouLeftOff).toBe("We stopped after defining the relaunch proof.");
    expect(pack.sessionState).toContain("No terminal");
    expect(store.getBootstrap().state.lastRoute).toBe("home");
    store.close();

    const reopened = await HearthStore.open(dataDirectory, "C:\\Projects\\Hearth");
    const restored = reopened.getBootstrap();
    expect(restored.state.objective).toContain("reload and relaunch");
    expect(restored.returnPack.whereYouLeftOff).toContain("relaunch proof");
    expect(restored.conversations.maker.some((message) => message.text.includes("test the memory"))).toBe(true);
    expect(restored.captures[0]?.text).toBe("https://example.com/continuity");
    const backups = await readdir(path.join(dataDirectory, "backups"));
    expect(backups.some((file) => file.includes("startup-pre-migration"))).toBe(true);
    reopened.close();
  });

  it("keeps Maker's visible conversation with the project it belongs to", async () => {
    const dataDirectory = await mkdtemp(path.join(os.tmpdir(), "hearth-maker-project-chat-"));
    cleanup.push(dataDirectory);
    const store = await HearthStore.open(dataDirectory, "C:\\Projects\\Hearth");
    const revive = {
      workspaceProjectId: "workspace-revive",
      rootPath: "C:\\Projects\\AOLRevive"
    };
    const personalOs = {
      workspaceProjectId: "workspace-personalos",
      rootPath: "C:\\Projects\\PersonalOS"
    };

    store.sendAgentMessage(
      "maker",
      "Keep working on the Revive sign-in flow.",
      undefined,
      "I am on the Revive sign-in flow.",
      revive
    );
    store.sendAgentMessage(
      "maker",
      "Open the PersonalOS dashboard.",
      undefined,
      "I am looking at the PersonalOS dashboard.",
      personalOs
    );

    expect(store.getAgentConversation("maker", revive).map((message) => message.text)).toEqual([
      "Keep working on the Revive sign-in flow.",
      "I am on the Revive sign-in flow."
    ]);
    expect(
      store.getBootstrap(undefined, personalOs).conversations.maker.map(
        (message) => message.text
      )
    ).toEqual([
      "Open the PersonalOS dashboard.",
      "I am looking at the PersonalOS dashboard."
    ]);
    store.close();

    const reopened = await HearthStore.open(dataDirectory, "C:\\Projects\\Hearth");
    expect(
      reopened.getBootstrap(undefined, revive).conversations.maker.at(-1)?.text
    ).toBe("I am on the Revive sign-in flow.");
    reopened.close();
  });

  it("persists the project-bound Workshop workstream separately from Maker conversation", async () => {
    const dataDirectory = await mkdtemp(path.join(os.tmpdir(), "hearth-workshop-turns-"));
    cleanup.push(dataDirectory);
    const workspace = {
      workspaceProjectId: "workspace-hearth",
      rootPath: "C:\\Projects\\Hearth"
    };
    const store = await HearthStore.open(dataDirectory, workspace.rootPath);
    const requestId = "turn-workshop-one";

    store.startWorkshopTurn(requestId, workspace, "Find the race and prove the fix.", {
      continuingSession: false,
      promptCharacters: 420,
      contributions: [{
        kind: "current_direction",
        label: "Current direction",
        characters: 33,
        truncated: false,
        detail: "Your current Workshop message, supplied in full."
      }],
      preservedUserTail: [],
      capturedAt: "2026-08-01T12:00:00.000Z"
    }, "2026-08-01T12:00:00.000Z");
    store.recordWorkshopActivity(requestId, {
      id: "tool-read",
      kind: "read",
      title: "Read protocol flow",
      status: "completed",
      locations: ["src/protocol/flow.ts"],
      updatedAt: "2026-08-01T12:00:01.000Z"
    });
    store.saveWorkshopPlan(requestId, [
      { content: "Trace the protocol path", priority: "high", status: "completed" },
      { content: "Run the focused test", priority: "high", status: "in_progress" }
    ]);
    store.appendWorkshopThought(requestId, "The state transition is shared across two callers.");
    store.saveWorkshopSessionState(requestId, {
      modeId: "plan",
      modeName: "Plan Mode",
      availableModes: [],
      ultracodeRequested: false,
      contextUsed: 31_400,
      contextSize: 100_000,
      inputTokens: 28_000,
      outputTokens: 3_400,
      cachedReadTokens: 0,
      cachedWriteTokens: 0
    });
    store.saveWorkshopHealth(requestId, {
      state: "working",
      turnStartedAt: "2026-08-01T12:00:00.000Z",
      lastProviderEventAt: "2026-08-01T12:00:02.000Z",
      lastToolEventAt: "2026-08-01T12:00:01.000Z",
      lastTerminalActivityAt: null,
      pendingPermissionSince: null,
      connection: "connected",
      process: "running",
      idleDeadlineAt: "2026-08-01T12:10:02.000Z",
      absoluteDeadlineAt: "2026-08-01T14:00:00.000Z",
      failure: null
    });
    store.saveWorkshopUsage(requestId, {
      model: "Claude Opus 5",
      modelSource: "reported",
      inputTokens: 28_000,
      outputTokens: 3_400,
      cachedReadTokens: 0,
      cachedWriteTokens: 0,
      contextUsed: 31_400,
      contextSize: 100_000,
      estimatedPromptCharacters: 31,
      reportedAt: "2026-08-01T12:00:03.000Z"
    });
    store.finishWorkshopTurn(requestId, "completed");

    expect(store.getWorkshopTurns(workspace)).toMatchObject([
      {
        id: requestId,
        prompt: "Find the race and prove the fix.",
        status: "completed",
        thoughts: "The state transition is shared across two callers.",
        activities: [{ id: "tool-read", locations: ["src/protocol/flow.ts"] }],
        plan: [{ status: "completed" }, { status: "in_progress" }],
        sessionState: { modeId: "plan", contextUsed: 31_400 },
        health: { state: "working", connection: "connected" },
        usage: { model: "Claude Opus 5", outputTokens: 3_400 },
        contextManifest: { promptCharacters: 420, continuingSession: false }
      }
    ]);
    expect(store.getAgentConversation("maker", workspace)).toHaveLength(0);
    store.saveManagedMakerSession(workspace.rootPath, "session-to-retire");
    expect(store.getMakerContinuationSession(workspace.rootPath)).toBe("session-to-retire");
    store.clearManagedMakerSession(workspace.rootPath);
    expect(store.getMakerContinuationSession(workspace.rootPath)).toBeNull();
    store.close();

    const reopened = await HearthStore.open(dataDirectory, workspace.rootPath);
    expect(reopened.getWorkshopTurns(workspace)[0]).toMatchObject({
      id: requestId,
      status: "completed",
      activities: [{ title: "Read protocol flow" }],
      health: { lastToolEventAt: "2026-08-01T12:00:01.000Z" },
      usage: { estimatedPromptCharacters: 31 },
      contextManifest: { contributions: [{ kind: "current_direction" }] }
    });
    reopened.close();
  });

  it("repairs v23's falsely assigned legacy chat without disturbing other project sessions", async () => {
    const dataDirectory = await mkdtemp(path.join(os.tmpdir(), "hearth-maker-v23-repair-"));
    cleanup.push(dataDirectory);
    const personalOsRoot = "C:\\Projects\\PersonalOS";
    const reviveRoot = "C:\\Projects\\AOLRevive";
    const store = await HearthStore.open(dataDirectory, "C:\\Projects\\Hearth");
    store.saveManagedMakerSession(personalOsRoot, "personalos-contaminated-session");
    store.saveManagedMakerSession(reviveRoot, "revive-valid-session");
    const databasePath = store.databasePath;
    store.close();

    const v23Database = new DatabaseSync(databasePath);
    v23Database.exec(`
      DELETE FROM schema_migrations WHERE version = 24;
    `);
    v23Database
      .prepare(`
        UPDATE messages
        SET root_path = ?
        WHERE agent = 'maker' AND workspace_project_id IS NULL
      `)
      .run(personalOsRoot);
    v23Database.close();

    const repaired = await HearthStore.open(dataDirectory, "C:\\Projects\\Hearth");
    expect(
      repaired.getBootstrap(undefined, {
        workspaceProjectId: "workspace-personalos",
        rootPath: personalOsRoot
      }).conversations.maker
    ).toHaveLength(0);
    expect(repaired.getMakerContinuationSession(personalOsRoot)).toBeNull();
    expect(repaired.getMakerContinuationSession(reviveRoot)).toBe(
      "revive-valid-session"
    );
    expect(repaired.getAgentConversation("maker")[0]?.text).toContain(
      "Workshop"
    );
    repaired.close();
  });

  it("organizes Library items and refuses to create duplicate links", async () => {
    const dataDirectory = await mkdtemp(path.join(os.tmpdir(), "hearth-library-"));
    cleanup.push(dataDirectory);
    const store = await HearthStore.open(dataDirectory, "C:\\Projects\\Hearth");

    const first = store.saveCapture("https://Example.com/tools/#overview", {
      id: "workspace-tools",
      name: "Tools"
    });
    const duplicate = store.saveCapture("https://example.com/tools", {
      id: "workspace-other",
      name: "Other"
    });
    expect(first.duplicate).toBe(false);
    expect(duplicate.duplicate).toBe(true);
    expect(duplicate.capture.id).toBe(first.capture.id);

    const organized = store.updateCapture(first.capture.id, {
      title: "Useful tools",
      description: "The short list worth returning to.",
      tags: ["Terminal", "terminal", "Reference"],
      pinned: true
    });
    expect(organized).toMatchObject({
      title: "Useful tools",
      pinned: true,
      tags: ["terminal", "reference"]
    });
    const enriched = store.applyCaptureMetadata(first.capture.id, {
      title: "Remote title must not replace mine",
      description: "Remote description must not replace mine"
    });
    expect(enriched.title).toBe("Useful tools");
    expect(enriched.description).toBe("The short list worth returning to.");
    expect(enriched.metadataFetchedAt).not.toBeNull();

    store.updateCapture(first.capture.id, { archived: true, pinned: false });
    const restored = store.updateCapture(first.capture.id, { archived: false });
    expect(restored.archived).toBe(false);
    expect(restored.pinned).toBe(false);
    store.close();
  });

  it("routes capture tokens into canonical homes and real relationships", async () => {
    const dataDirectory = await mkdtemp(path.join(os.tmpdir(), "hearth-routing-"));
    cleanup.push(dataDirectory);
    const store = await HearthStore.open(dataDirectory, "C:\\Projects\\Hearth");
    const projects = [
      { id: "project-hearth", name: "Hearth" },
      { id: "project-review", name: "Review Project" }
    ];

    const idea = store.saveCapture(
      "@idea Build a calmer voice handoff #Voice #mobile",
      undefined,
      undefined,
      projects
    ).capture;
    expect(idea).toMatchObject({
      kind: "idea",
      text: "Build a calmer voice handoff",
      tags: ["voice", "mobile"],
      workspaceProjectId: null
    });

    const note = store.saveCapture(
      '@note @"Review Project" Maker felt cramped at 1080p #ui',
      undefined,
      undefined,
      projects
    ).capture;
    expect(note).toMatchObject({
      kind: "note",
      text: "Maker felt cramped at 1080p",
      tags: ["ui"],
      workspaceProjectId: "project-review",
      projectName: "Review Project"
    });
    const looseNote = store.updateCapture(note.id, {
      workspaceProjectId: null
    });
    expect(looseNote).toMatchObject({
      workspaceProjectId: null,
      projectName: null
    });
    const reconnectedNote = store.updateCapture(
      note.id,
      { workspaceProjectId: "project-review" },
      projects
    );
    expect(reconnectedNote).toMatchObject({
      workspaceProjectId: "project-review",
      projectName: "Review Project"
    });
    expect(() =>
      store.updateCapture(idea.id, { workspaceProjectId: null })
    ).toThrow("Only notes");

    const link = store.saveCapture(
      "https://example.com/tool @Hearth #terminal Useful terminal reference",
      undefined,
      undefined,
      projects
    ).capture;
    expect(link).toMatchObject({
      kind: "link",
      text: "https://example.com/tool",
      description: "Useful terminal reference",
      tags: ["terminal"],
      workspaceProjectId: "project-hearth"
    });

    const duplicate = store.saveCapture(
      "https://example.com/tool #windows",
      undefined,
      undefined,
      projects
    );
    expect(duplicate.duplicate).toBe(true);
    expect(duplicate.capture.tags).toEqual(["terminal", "windows"]);
    expect(store.searchCaptures("cramped ui")).toEqual([
      expect.objectContaining({ id: note.id, kind: "note" })
    ]);
    expect(store.searchCaptures("review project", "note")).toEqual([
      expect.objectContaining({ id: note.id, projectName: "Review Project" })
    ]);
    expect(store.searchCaptures("terminal windows", "link")).toEqual([
      expect.objectContaining({ id: link.id, tags: ["terminal", "windows"] })
    ]);
    expect(store.searchCaptures("terminal", "idea")).toEqual([]);
    store.close();
  });

  it("keeps Studio idea decisions explicit, reversible, and persistent", async () => {
    const dataDirectory = await mkdtemp(path.join(os.tmpdir(), "hearth-studio-"));
    cleanup.push(dataDirectory);
    const store = await HearthStore.open(dataDirectory, "C:\\Projects\\Hearth");

    const saved = store.saveCapture(
      "Build a calm place for half-formed tools.",
      undefined,
      "idea"
    );
    expect(saved.capture).toMatchObject({
      kind: "idea",
      ideaState: "resting",
      ideaDecidedAt: null,
      promotionKind: null,
      promotedAt: null
    });
    const putAway = store.updateCapture(saved.capture.id, { archived: true });
    expect(putAway).toMatchObject({
      kind: "idea",
      ideaState: "let-go",
      archived: false
    });
    const broughtBack = store.updateCapture(saved.capture.id, { archived: false });
    expect(broughtBack).toMatchObject({
      kind: "idea",
      ideaState: "resting",
      archived: false
    });

    const pursuing = store.updateCapture(saved.capture.id, {
      ideaState: "pursuing"
    });
    expect(pursuing.ideaState).toBe("pursuing");
    expect(pursuing.ideaDecidedAt).toBeTruthy();
    const conversation = store.sendIdeaMessage(
      saved.capture.id,
      "What is the useful core of this?",
      "A quiet place to decide whether the tool deserves to exist."
    );
    expect(conversation.map((message) => message.role)).toEqual([
      "user",
      "assistant"
    ]);
    const promoted = store.promoteIdea(
      saved.capture.id,
      { id: "workspace-calm-tools", name: "Calm Tools" },
      "existing"
    );
    expect(promoted).toMatchObject({
      workspaceProjectId: "workspace-calm-tools",
      projectName: "Calm Tools",
      promotionKind: "existing"
    });
    expect(promoted.promotedAt).toBeTruthy();
    expect(() =>
      store.promoteIdea(
        saved.capture.id,
        { id: "workspace-other", name: "Other" },
        "existing"
      )
    ).toThrow("already connected");
    expect(() =>
      store.updateCapture(
        store.saveCapture("A plain note").capture.id,
        { ideaState: "pursuing" }
      )
    ).toThrow("Only ideas can move through Studio");

    store.setRoute("studio");
    store.close();

    const reopened = await HearthStore.open(dataDirectory, "C:\\Projects\\Hearth");
    expect(reopened.getBootstrap().state.lastRoute).toBe("studio");
    expect(
      reopened.getBootstrap().captures.find((item) => item.id === saved.capture.id)
    ).toMatchObject({
      ideaState: "pursuing",
      projectName: "Calm Tools",
      promotionKind: "existing"
    });
    expect(reopened.getIdeaConversation(saved.capture.id)).toHaveLength(2);
    const letGo = reopened.updateCapture(saved.capture.id, { ideaState: "let-go" });
    expect(letGo.ideaState).toBe("let-go");
    const resting = reopened.updateCapture(saved.capture.id, { ideaState: "resting" });
    expect(resting.ideaState).toBe("resting");
    expect(resting.ideaDecidedAt).toBeNull();
    reopened.close();
  });

  it("builds one searchable Archive view from existing recoverable records", async () => {
    const dataDirectory = await mkdtemp(path.join(os.tmpdir(), "hearth-archive-"));
    cleanup.push(dataDirectory);
    const store = await HearthStore.open(dataDirectory, "C:\\Projects\\Hearth");

    const libraryItem = store.saveCapture(
      "https://example.com/archive-reference"
    ).capture;
    store.updateCapture(libraryItem.id, {
      title: "Archive reference",
      archived: true
    });
    const idea = store.saveCapture(
      "A deliberately reversible idea.",
      undefined,
      "idea"
    ).capture;
    store.updateCapture(idea.id, { ideaState: "let-go" });
    const removableReturnPack = store.leaveProject(
      "Stopped after proving Archive aggregation."
    );

    const makerMessages = store.sendAgentMessage(
      "maker",
      "Prepare an Archive handoff.",
      undefined,
      "Keep Archive calm and bounded."
    );
    const discarded = store.createMakerProposal(makerMessages.at(-1)!, {
      instruction: "Add noisy activity charts to Archive.",
      rationale: "An intentionally rejected direction.",
      expectedFiles: ["src/renderer/src/ArchiveRoom.tsx"],
      risk: "medium",
      riskSummary: "The interaction would become noisy."
    });
    store.discardMakerProposal(discarded.id);
    const editBackupPath = path.join(
      store.backupsPath,
      "project-edits",
      "89f6df5b-0649-4e87-ac6a-546596dc01c9.original"
    );
    await mkdir(path.dirname(editBackupPath), { recursive: true });
    await writeFile(editBackupPath, "private original");
    store.recordProjectEdit({
      id: "89f6df5b-0649-4e87-ac6a-546596dc01c9",
      projectId: "workspace-hearth",
      projectName: "Hearth",
      rootPath: "C:\\Projects\\Hearth",
      path: "src/archive.ts",
      originalHash: "original",
      appliedHash: "applied",
      backupPath: editBackupPath,
      additions: 4,
      deletions: 1,
      appliedAt: "2026-07-29T17:30:00.000Z",
      restoredAt: null
    });

    const archive = store.getArchive();
    expect(archive.counts).toMatchObject({
      library: 1,
      idea: 1,
      handoff: 1,
      edit: 1
    });
    expect(archive.counts["return-pack"]).toBeGreaterThanOrEqual(2);
    expect(
      archive.items.find((item) => item.kind === "return-pack")?.returnPack
    ).toMatchObject({
      whereYouLeftOff: "Stopped after proving Archive aggregation."
    });
    expect(
      archive.items.find((item) => item.id === libraryItem.id)
    ).toMatchObject({
      kind: "library",
      action: "restore-library",
      title: "Archive reference",
      returnPack: null
    });
    expect(archive.items.find((item) => item.id === idea.id)).toMatchObject({
      kind: "idea",
      action: "restore-idea"
    });
    expect(archive.items.find((item) => item.id === discarded.id)).toMatchObject({
      kind: "handoff",
      status: "Discarded",
      action: null
    });
    expect(
      archive.items.find(
        (item) => item.id === "89f6df5b-0649-4e87-ac6a-546596dc01c9"
      )
    ).toMatchObject({
      kind: "edit",
      status: "Undo available",
      action: "undo-edit"
    });
    expect(
      archive.items.find(
        (item) => item.id === "89f6df5b-0649-4e87-ac6a-546596dc01c9"
      )?.removal
    ).toMatchObject({
      removesFile: true
    });

    expect(
      store.removeArchiveItem(
        "89f6df5b-0649-4e87-ac6a-546596dc01c9",
        "edit"
      )
    ).toMatchObject({ removedFile: true });
    await expect(access(editBackupPath)).rejects.toThrow();
    const outsideBackupPath = path.join(dataDirectory, "outside.original");
    await writeFile(outsideBackupPath, "must remain");
    const unsafeEditId = "11d9bab3-9314-45ef-beba-3b2d55de8490";
    store.recordProjectEdit({
      id: unsafeEditId,
      projectId: "workspace-hearth",
      projectName: "Hearth",
      rootPath: "C:\\Projects\\Hearth",
      path: "src/unsafe.ts",
      originalHash: "original",
      appliedHash: "applied",
      backupPath: outsideBackupPath,
      additions: 1,
      deletions: 0,
      appliedAt: "2026-07-29T17:31:00.000Z",
      restoredAt: null
    });
    expect(() => store.removeArchiveItem(unsafeEditId, "edit")).toThrow(
      "outside its private backup folder"
    );
    await expect(access(outsideBackupPath)).resolves.toBeUndefined();
    expect(store.getArchive().items.some((item) => item.id === unsafeEditId)).toBe(
      true
    );
    store.removeArchiveItem(discarded.id, "handoff");
    store.removeArchiveItem(removableReturnPack.id, "return-pack");
    expect(store.getArchive().items.some((item) => item.id === discarded.id)).toBe(
      false
    );

    store.updateCapture(libraryItem.id, { archived: false });
    store.updateCapture(idea.id, { ideaState: "resting" });
    const restoredArchive = store.getArchive();
    expect(restoredArchive.items.some((item) => item.id === libraryItem.id)).toBe(
      false
    );
    expect(restoredArchive.items.some((item) => item.id === idea.id)).toBe(false);

    const disposable = store.saveCapture(
      "@note Temporary Archive material."
    ).capture;
    expect(() => store.removeArchiveItem(disposable.id, "library")).toThrow(
      "no longer available"
    );
    store.updateCapture(disposable.id, { archived: true });
    expect(
      store.removeArchiveItem(disposable.id, "library")
    ).toMatchObject({ removedFile: false });
    expect(store.getCapture(disposable.id)).toBeNull();

    store.setRoute("archive");
    store.close();
    const reopened = await HearthStore.open(
      dataDirectory,
      "C:\\Projects\\Hearth"
    );
    expect(reopened.getBootstrap().state.lastRoute).toBe("archive");
    reopened.close();
  });

  it("bounds automatic startup backups while preserving other backups", async () => {
    const dataDirectory = await mkdtemp(path.join(os.tmpdir(), "hearth-retention-"));
    cleanup.push(dataDirectory);
    const store = await HearthStore.open(dataDirectory, "C:\\Projects\\Hearth");
    store.close();

    const backupsPath = path.join(dataDirectory, "backups");
    const database = new DatabaseSync(path.join(dataDirectory, "hearth.sqlite"));
    const insert = database.prepare(
      "INSERT INTO backups(id, reason, file_path, created_at) VALUES (?, ?, ?, ?)"
    );
    for (let index = 0; index < 12; index += 1) {
      const filePath = path.join(backupsPath, `old-startup-${index}.sqlite`);
      await writeFile(filePath, `backup ${index}`);
      insert.run(
        `old-startup-${index}`,
        "startup-pre-migration",
        filePath,
        new Date(Date.UTC(2026, 0, 1, 0, 0, index)).toISOString()
      );
    }
    const manualPath = path.join(backupsPath, "manual-keep.sqlite");
    await writeFile(manualPath, "manual backup");
    insert.run(
      "manual-keep",
      "manual",
      manualPath,
      "2026-01-01T01:00:00.000Z"
    );
    database.close();

    const reopened = await HearthStore.open(
      dataDirectory,
      "C:\\Projects\\Hearth"
    );
    reopened.close();

    const verified = new DatabaseSync(path.join(dataDirectory, "hearth.sqlite"));
    const automaticCount = Number(
      (
        verified
          .prepare(
            "SELECT COUNT(*) AS count FROM backups WHERE reason = 'startup-pre-migration'"
          )
          .get() as Record<string, unknown>
      ).count
    );
    const manualCount = Number(
      (
        verified
          .prepare("SELECT COUNT(*) AS count FROM backups WHERE reason = 'manual'")
          .get() as Record<string, unknown>
      ).count
    );
    verified.close();
    expect(automaticCount).toBe(8);
    expect(manualCount).toBe(1);
    await expect(access(manualPath)).resolves.toBeUndefined();
  });

  it("keeps reversible discovery feedback and bounded Librarian evidence", async () => {
    const dataDirectory = await mkdtemp(path.join(os.tmpdir(), "hearth-library-taste-"));
    cleanup.push(dataDirectory);
    const store = await HearthStore.open(dataDirectory, "C:\\Projects\\Hearth");
    store.saveCapture("https://github.com/microsoft/terminal", {
      id: "workspace-hearth",
      name: "Hearth"
    });
    store.replaceLibraryDiscovery(
      [
        {
          id: "github-opencode",
          kind: "repo",
          name: "anomalyco/opencode",
          description: "An open source coding agent.",
          url: "https://github.com/anomalyco/opencode",
          stars: 100_000,
          language: "TypeScript",
          topics: ["agent", "terminal"],
          reason: "Matches Hearth's agent work.",
          emerging: false,
          pushedAt: "2026-07-29T12:00:00.000Z",
          feedback: "none"
        },
        {
          id: "github-skills",
          kind: "skill",
          name: "example/skills",
          description: "A skill collection.",
          url: "https://github.com/example/skills",
          stars: 500,
          language: "Python",
          topics: ["skills"],
          reason: "Current agent skills.",
          emerging: true,
          pushedAt: "2026-07-28T12:00:00.000Z",
          feedback: "none"
        }
      ],
      "2026-07-29T12:30:00.000Z"
    );

    expect(
      store.setLibraryDiscoveryFeedback("github-opencode", "kept").items[0]?.feedback
    ).toBe("kept");
    expect(
      store.setLibraryDiscoveryFeedback("github-skills", "dismissed").items.at(-1)
        ?.feedback
    ).toBe("dismissed");
    expect(store.getLibraryDiscoveryTaste()).toMatchObject({
      keptLanguages: ["typescript"],
      dismissedLanguages: ["python"],
      keptTopics: ["agent", "terminal"],
      dismissedTopics: ["skills"],
      savedTerms: []
    });
    expect(store.getLibrarianEvidence("terminal agent")).toContain(
      "microsoft/terminal"
    );
    expect(store.getLibrarianEvidence("terminal agent")).toContain(
      "anomalyco/opencode"
    );

    const restored = store.setLibraryDiscoveryFeedback("github-skills", "none");
    expect(restored.items.find((item) => item.id === "github-skills")?.feedback).toBe(
      "none"
    );
    store.close();
  });

  it("keeps Companion and Maker conversations separate", async () => {
    const dataDirectory = await mkdtemp(path.join(os.tmpdir(), "hearth-agents-"));
    cleanup.push(dataDirectory);
    const store = await HearthStore.open(dataDirectory, "C:\\Projects\\Hearth");

    store.sendAgentMessage("companion", "Where did I leave off?");
    store.sendAgentMessage("maker", "Tell me about the terminal.");
    store.setAgentContext({
      id: "context-critic-test",
      agent: "critic",
      workspaceProjectId: "workspace-review",
      projectName: "Review Project",
      rootPath: "C:\\Projects\\Review",
      kind: "diff",
      path: "src/app.ts",
      paths: ["src/app.ts"],
      summary: "src/app.ts · 1 files · +4 / -1",
      evidence: ["Branch main", "0 staged", "0 untracked"],
      concerns: ["Code changed without a visible test change in the current working tree."],
      createdAt: "2026-07-28T17:00:00.000Z"
    });
    store.sendAgentMessage("critic", "Is this ready to ship?");

    const data = store.getBootstrap();
    expect(data.conversations.companion.at(-1)?.text).toContain("left off in Workshop");
    expect(data.conversations.maker.at(-1)?.text).toContain("terminal is real");
    expect(data.conversations.companion.every((message) => message.agent === "companion")).toBe(true);
    expect(data.conversations.maker.every((message) => message.agent === "maker")).toBe(true);
    expect(data.conversations.critic.at(-1)?.text).toContain("Not yet");
    expect(data.agentContexts.critic?.path).toBe("src/app.ts");
    expect(data.agentContexts.critic?.paths).toEqual(["src/app.ts"]);
    store.setAgentContext({
      id: "context-evidence-test",
      agent: "maker",
      workspaceProjectId: "workspace-review",
      projectName: "Review Project",
      rootPath: "C:\\Projects\\Review",
      kind: "evidence",
      path: null,
      paths: ["src/app.ts", "src/helper.ts"],
      summary: "2 deliberately selected files",
      evidence: ["src/app.ts · typescript", "src/helper.ts · typescript"],
      concerns: [],
      createdAt: "2026-07-28T17:05:00.000Z"
    });
    expect(store.getAgentContext("maker")?.paths).toEqual([
      "src/app.ts",
      "src/helper.ts"
    ]);
    store.close();
  });

  it("answers casual check-ins without leaking resident work context", async () => {
    const dataDirectory = await mkdtemp(path.join(os.tmpdir(), "hearth-social-"));
    cleanup.push(dataDirectory);
    const store = await HearthStore.open(dataDirectory, "C:\\Projects\\Hearth");

    for (const agent of ["companion", "maker", "critic", "librarian"] as const) {
      const messages = store.sendAgentMessage(agent, "Doing ok this afternoon?");
      const reply = messages.at(-1)?.text ?? "";
      expect(reply).toMatch(/doing|good|alright/i);
      expect(reply).not.toMatch(/project|terminal|catalog|discovery|correction/i);
    }
    store.close();
  });

  it("persists the chosen agent reasoning provider", async () => {
    const dataDirectory = await mkdtemp(path.join(os.tmpdir(), "hearth-provider-"));
    cleanup.push(dataDirectory);
    const store = await HearthStore.open(dataDirectory, "C:\\Projects\\Hearth");

    expect(store.getAgentProviderPreference()).toBe("claude-code");
    store.saveAgentProviderPreference("local");
    store.close();

    const reopened = await HearthStore.open(dataDirectory, "C:\\Projects\\Hearth");
    expect(reopened.getAgentProviderPreference()).toBe("local");
    reopened.close();
  });

  it("imports PersonalOS links idempotently without restoring put-away material", async () => {
    const dataDirectory = await mkdtemp(path.join(os.tmpdir(), "hearth-stacks-import-"));
    cleanup.push(dataDirectory);
    const store = await HearthStore.open(dataDirectory, "C:\\Projects\\Hearth");
    const existing = store.saveCapture(
      "https://example.com/already-here",
      undefined,
      "link"
    ).capture;
    store.updateCapture(existing.id, {
      title: "My Hearth title",
      tags: ["existing"],
      archived: true
    });
    const sourceItems = [
      {
        id: "one",
        url: "https://example.com/already-here",
        title: "PersonalOS title",
        domain: "example.com",
        collection: "Design Skills",
        tags: ["personalos", "design-skills"],
        capturedAt: "2026-07-20T12:00:00.000Z",
        alreadyInLibrary: true,
        needsCollection: true
      },
      {
        id: "two",
        url: "https://example.com/new-link",
        title: "A new reference",
        domain: "example.com",
        collection: "App Code",
        tags: ["personalos", "app-code"],
        capturedAt: "2026-07-21T12:00:00.000Z",
        alreadyInLibrary: false,
        needsCollection: false
      }
    ];

    expect(store.importPersonalOsStacks(sourceItems)).toEqual({
      imported: 1,
      alreadyPresent: 1,
      organized: 1
    });
    const putAway = store.findLibraryLinkByUrl(existing.text);
    expect(putAway).toMatchObject({
      title: "My Hearth title",
      tags: ["existing", "personalos", "design-skills"],
      libraryCollection: "Design Skills",
      archived: true
    });
    expect(store.findLibraryLinkByUrl("https://example.com/new-link")).toMatchObject({
      title: "A new reference",
      tags: ["personalos", "app-code"],
      libraryCollection: "App Code",
      archived: false
    });
    store.updateCapture(existing.id, {
      libraryCollection: "  My References  "
    });
    expect(store.importPersonalOsStacks(sourceItems)).toEqual({
      imported: 0,
      alreadyPresent: 2,
      organized: 0
    });
    expect(store.findLibraryLinkByUrl(existing.text)?.libraryCollection).toBe(
      "My References"
    );
    expect(store.searchCaptures("references", "link")).toHaveLength(1);
    expect(store.getLibrarianEvidence("archive my references")).toContain(
      '"collection": "My References"'
    );
    expect(store.searchCaptures("", "link")).toHaveLength(2);
    store.close();
  });

  it("pages and sorts the full Library with dependable shelf counts", async () => {
    const dataDirectory = await mkdtemp(path.join(os.tmpdir(), "hearth-library-page-"));
    cleanup.push(dataDirectory);
    const store = await HearthStore.open(dataDirectory, "C:\\Projects\\Hearth");
    const alpha = store.saveCapture("https://example.com/alpha", undefined, "link").capture;
    const beta = store.saveCapture("https://example.com/beta", undefined, "link").capture;
    const loose = store.saveCapture("https://example.com/loose", undefined, "link").capture;
    const archived = store.saveCapture("https://example.com/old", undefined, "link").capture;
    store.updateCapture(alpha.id, {
      title: "Alpha",
      libraryCollection: "References",
      pinned: true
    });
    store.updateCapture(beta.id, {
      title: "Beta",
      libraryCollection: "Tools"
    });
    store.updateCapture(loose.id, { title: "Loose" });
    store.updateCapture(archived.id, { title: "Old", archived: true });

    const first = store.listLibraryCaptures({
      query: "",
      shelf: "all",
      collection: null,
      sort: "title",
      offset: 0,
      limit: 2
    });
    expect(first.items.map((item) => item.title)).toEqual(["Alpha", "Beta"]);
    expect(first).toMatchObject({
      total: 3,
      hasMore: true,
      activeCount: 3,
      pinnedCount: 1,
      archivedCount: 1,
      unfiledCount: 1
    });
    expect(first.collections).toEqual([
      { name: "References", count: 1 },
      { name: "Tools", count: 1 }
    ]);
    const second = store.listLibraryCaptures({
      query: "loose",
      shelf: "all",
      collection: "",
      sort: "saved",
      offset: 0,
      limit: 20
    });
    expect(second.items.map((item) => item.id)).toEqual([loose.id]);
    expect(store.getLibrarianEvidence("What do you think?", beta.id)).toContain(
      '"title": "Beta"'
    );
    store.close();
  });

  it("persists one editable Maker proposal and records explicit outcomes", async () => {
    const dataDirectory = await mkdtemp(path.join(os.tmpdir(), "hearth-proposal-"));
    cleanup.push(dataDirectory);
    const store = await HearthStore.open(dataDirectory, "C:\\Projects\\Hearth");
    const messages = store.sendAgentMessage(
      "maker",
      "How should we tighten the handoff?",
      undefined,
      "Update the handoff surface and cover it with a persistence test."
    );
    const source = messages.at(-1)!;
    const proposal = store.createMakerProposal(source, {
      instruction: "Update the handoff surface and add a persistence test.",
      rationale: "It proves the approval boundary without broadening the terminal integration.",
      expectedFiles: ["src/renderer/src/WorkshopRoom.tsx", "tests/unit/store.test.ts"],
      risk: "low",
      riskSummary: "UI and local persistence only; run the focused checks before passing."
    });
    expect(proposal.consultations).toEqual([]);
    const consulted = store.recordCriticConsultation(proposal.id, {
      phase: "preflight",
      reason: "high-risk",
      note: "Maker asked Critic to pressure-test this."
    });
    expect(consulted.consultations).toHaveLength(1);
    expect(
      store.recordCriticConsultation(proposal.id, {
        phase: "preflight",
        reason: "unknown-risk",
        note: "This duplicate phase should not be added."
      }).consultations
    ).toHaveLength(1);
    const edited = store.updateMakerProposal(
      proposal.id,
      "Update only the handoff surface and add the persistence test."
    );
    expect(edited.instruction).toContain("only the handoff");
    store.close();

    const reopened = await HearthStore.open(dataDirectory, "C:\\Projects\\Hearth");
    expect(reopened.getBootstrap().makerProposal?.id).toBe(proposal.id);
    expect(reopened.getBootstrap().makerProposal?.expectedFiles).toHaveLength(2);
    expect(reopened.getBootstrap().makerProposal?.consultations).toMatchObject([
      {
        from: "maker",
        to: "critic",
        phase: "preflight",
        reason: "high-risk"
      }
    ]);
    const passed = reopened.completeMakerProposal(proposal.id);
    expect(passed.status).toBe("passed");
    expect(reopened.getBootstrap().makerProposal?.status).toBe("passed");
    const reported = reopened.recordMakerExecutionResult(proposal.id, {
      changedFiles: ["src/renderer/src/WorkshopRoom.tsx"],
      validation: ["Unit tests passed"],
      concerns: [],
      decision: "Approve the installer build?",
      corroboration: null
    });
    expect(reported.executionResult?.decision).toBe("Approve the installer build?");
    reopened.closeMakerProposal(proposal.id);
    expect(reopened.getBootstrap().makerProposal).toBeNull();
    reopened.close();
  });

  it("persists terminal identity without persisting terminal output", async () => {
    const dataDirectory = await mkdtemp(path.join(os.tmpdir(), "hearth-terminal-"));
    cleanup.push(dataDirectory);
    const store = await HearthStore.open(dataDirectory, "C:\\Projects\\Hearth");
    const session: TerminalSession = {
      id: "b4d86457-9b64-41a4-a165-38805a2c29b4",
      projectId: "project-hearth",
      cwd: "C:\\Projects\\Hearth",
      pid: 4242,
      kind: "claude",
      owner: "maker",
      lifecycle: "running",
      startedAt: "2026-07-28T12:00:00.000Z",
      lastActivityAt: "2026-07-28T12:01:00.000Z",
      exitedAt: null,
      exitCode: null,
      claudeSessionId: "995c88ce-555b-4d34-b2e9-85eff36fd001",
      claudeName: "Hearth Maker",
      claudeResumable: true,
      cols: 132,
      rows: 38
    };
    store.saveTerminalSession(session);
    expect(store.getLatestTerminalSession()).toEqual(session);
    store.close();

    const reopened = await HearthStore.open(dataDirectory, "C:\\Projects\\Hearth");
    expect(reopened.getLatestTerminalSession()).toEqual(session);
    const databaseBytes = await import("node:fs/promises").then((fs) =>
      fs.readFile(reopened.databasePath)
    );
    expect(databaseBytes.toString("utf8")).not.toContain("secret terminal output");
    reopened.close();
  });

  it("continues the newest Maker conversation for the selected project", async () => {
    const dataDirectory = await mkdtemp(path.join(os.tmpdir(), "hearth-maker-continuity-"));
    cleanup.push(dataDirectory);
    const store = await HearthStore.open(dataDirectory, "C:\\Projects\\Hearth");
    const rootPath = "C:\\Projects\\AOLRevive";

    store.saveTerminalSession({
      id: "1c8d68e8-f084-47ad-bd26-29d0b4ff6878",
      projectId: "project-hearth",
      cwd: rootPath,
      pid: null,
      kind: "claude",
      owner: "user",
      lifecycle: "stopped",
      startedAt: "2026-07-31T16:00:00.000Z",
      lastActivityAt: "2026-07-31T17:00:00.000Z",
      exitedAt: "2026-07-31T17:00:00.000Z",
      exitCode: 0,
      claudeSessionId: "0364aba9-ae67-448c-b48f-921a558e1eba",
      claudeName: "AOLRevive session",
      claudeResumable: true,
      cols: 120,
      rows: 32
    });

    expect(store.getMakerContinuationSession(rootPath)).toBe(
      "0364aba9-ae67-448c-b48f-921a558e1eba"
    );
    expect(store.getMakerContinuationSession("C:\\Projects\\Other")).toBeNull();

    store.saveManagedMakerSession(
      rootPath.toLocaleLowerCase(),
      "8c32f9e3-0982-496c-a956-4e0af41d5aac"
    );
    expect(store.getMakerContinuationSession(rootPath)).toBe(
      "8c32f9e3-0982-496c-a956-4e0af41d5aac"
    );
    store.close();

    const reopened = await HearthStore.open(dataDirectory, "C:\\Projects\\Hearth");
    expect(reopened.getMakerContinuationSession(rootPath)).toBe(
      "8c32f9e3-0982-496c-a956-4e0af41d5aac"
    );
    reopened.close();
  });

  it("migrates unverified legacy Claude IDs into a truthful fresh-start state", async () => {
    const dataDirectory = await mkdtemp(path.join(os.tmpdir(), "hearth-resume-migration-"));
    cleanup.push(dataDirectory);
    const store = await HearthStore.open(dataDirectory, "C:\\Projects\\Hearth");
    store.saveTerminalSession({
      id: "ae0c15b8-60d3-4a1e-82df-fdb31bed48ef",
      projectId: "project-hearth",
      cwd: "C:\\Projects\\Hearth",
      pid: null,
      kind: "claude",
      owner: "user",
      lifecycle: "failed",
      startedAt: "2026-07-28T12:00:00.000Z",
      lastActivityAt: "2026-07-28T12:01:00.000Z",
      exitedAt: "2026-07-28T12:01:00.000Z",
      exitCode: 1,
      claudeSessionId: "331b8c49-5c9e-4033-ac3a-0284bda17f8d",
      claudeName: "Unverified session",
      claudeResumable: false,
      cols: 120,
      rows: 32
    });
    const databasePath = store.databasePath;
    store.close();

    const legacyDatabase = new DatabaseSync(databasePath);
    legacyDatabase.exec(`
      DELETE FROM schema_migrations WHERE version = 4;
      ALTER TABLE terminal_sessions DROP COLUMN claude_resumable;
    `);
    legacyDatabase.close();

    const migrated = await HearthStore.open(dataDirectory, "C:\\Projects\\Hearth");
    expect(migrated.getLatestTerminalSession()).toMatchObject({
      claudeSessionId: null,
      claudeResumable: false
    });
    migrated.close();
  });

  it("migrates existing conversations to the separate Critic boundary", async () => {
    const dataDirectory = await mkdtemp(path.join(os.tmpdir(), "hearth-critic-migration-"));
    cleanup.push(dataDirectory);
    const store = await HearthStore.open(dataDirectory, "C:\\Projects\\Hearth");
    store.saveWorkspaceSelection("C:\\Projects\\Review");
    const databasePath = store.databasePath;
    store.close();

    const legacyDatabase = new DatabaseSync(databasePath);
    legacyDatabase.exec(`
      DELETE FROM messages WHERE agent = 'critic';
      DROP TABLE agent_contexts;

      CREATE TABLE messages_v1 (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        agent TEXT NOT NULL CHECK (agent IN ('maker', 'companion')),
        role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
        text TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      INSERT INTO messages_v1(id, project_id, agent, role, text, created_at)
      SELECT id, project_id, agent, role, text, created_at
      FROM messages;

      DROP TABLE messages;
      ALTER TABLE messages_v1 RENAME TO messages;
      CREATE INDEX messages_project_agent_created
        ON messages(project_id, agent, created_at);
      DELETE FROM schema_migrations WHERE version IN (5, 23, 24);
    `);
    legacyDatabase.close();

    const migrated = await HearthStore.open(dataDirectory, "C:\\Projects\\Hearth");
    expect(migrated.getBootstrap().conversations.critic.at(-1)?.text).toContain(
      "resistance instead of reassurance"
    );
    expect(migrated.getBootstrap().agentContexts.critic).toBeNull();
    expect(() => migrated.sendAgentMessage("critic", "What do you need?")).not.toThrow();
    expect(
      migrated.getBootstrap(undefined, {
        workspaceProjectId: "workspace-review",
        rootPath: "C:\\Projects\\Review"
      }).conversations.maker
    ).toHaveLength(0);
    migrated.close();
  });
});
