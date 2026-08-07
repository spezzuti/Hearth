import {
  app,
  BrowserWindow,
  clipboard,
  ipcMain,
  Menu,
  Notification,
  session,
  shell,
  Tray,
  utilityProcess,
  type IpcMainInvokeEvent,
  type UtilityProcess
} from "electron";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { CompanionServer } from "./companion-server";
import { CompanionRemoteTransport } from "./companion-transport";
import { QuietNotificationCenter } from "./notification-center";
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  coreRequestSchema,
  type AgentContextKind,
  type AgentKey,
  type AgentProviderSelection,
  type AgentStreamEvent,
  type ArchiveKind,
  type CapturePatch,
  type ContextAgent,
  type CoreMethod,
  type CoreResponse,
  type HouseMemoryInput,
  type HouseMemoryPatch,
  type IdeaPromotionTarget,
  type LibraryDiscoveryFeedback,
  type LibraryCaptureQuery,
  type LivingRoomEvent,
  type LivingRoomMode,
  type NotificationPreferences,
  type ReasoningAgent,
  type Room,
  type TerminalEvent,
  type TerminalKind,
  type TerminalOwner,
  type TerminalSnapshot
} from "../shared/contracts";

const isDevelopment = Boolean(process.env.VITE_DEV_SERVER_URL);
const WINDOWS_APP_ID = "home.hearth.desktop";
const windowsAppId = app.isPackaged
  ? WINDOWS_APP_ID
  : `${WINDOWS_APP_ID}.development`;

const electronDataDirectory = process.env.HEARTH_DATA_DIR
  ? path.join(path.resolve(process.env.HEARTH_DATA_DIR), "electron-shell")
  : !app.isPackaged
    ? path.join(app.getPath("appData"), "Hearth Development")
    : null;

if (electronDataDirectory) {
  mkdirSync(electronDataDirectory, { recursive: true });
  app.setPath("userData", electronDataDirectory);
}

if (process.platform === "win32") {
  app.setAppUserModelId(windowsAppId);
}

const ownsPrimaryInstance = app.requestSingleInstanceLock();
if (!ownsPrimaryInstance) {
  app.quit();
}

let mainWindow: BrowserWindow | null = null;
let quitting = false;
let pendingWorkshopAttention: string | null = null;
let tray: Tray | null = null;

const notifications = new QuietNotificationCenter(
  {
    supported: () => Notification.isSupported(),
    windowIsHidden: () =>
      Boolean(
        mainWindow &&
        !mainWindow.isDestroyed() &&
        (mainWindow.isMinimized() || !mainWindow.isVisible())
      ),
    create: (options) =>
      new Notification({
        ...options,
        timeoutType: "default"
      }),
    reveal: (room) => revealMainWindow(room),
    now: () => new Date().toISOString()
  },
  DEFAULT_NOTIFICATION_PREFERENCES
);

function hearthIconPath(): string {
  return app.isPackaged
    ? path.join(process.resourcesPath, "tray.ico")
    : path.join(app.getAppPath(), "build", "tray.ico");
}

function revealMainWindow(room?: Room): void {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  if (!mainWindow.isVisible()) mainWindow.show();
  mainWindow.focus();
  if (
    room &&
    !mainWindow.webContents.isDestroyed()
  ) {
    mainWindow.webContents.send("hearth:notification-navigation", room);
  }
  updateTrayPresentation();
}

if (ownsPrimaryInstance) {
  app.on("second-instance", () => {
    revealMainWindow();
  });
}

function updateTrayPresentation(): void {
  if (!tray || tray.isDestroyed()) return;
  const waiting = Boolean(pendingWorkshopAttention);
  tray.setToolTip(
    waiting ? "Hearth · Workshop needs input" : "Hearth · working home"
  );
  tray.setContextMenu(
    Menu.buildFromTemplate([
      {
        label: "Open Hearth",
        click: () => revealMainWindow()
      },
      {
        label: waiting ? "Workshop needs input" : "Workshop is quiet",
        enabled: false
      },
      { type: "separator" },
      {
        label: "Quit Hearth",
        click: () => app.quit()
      }
    ])
  );
}

function ensureTray(): void {
  if (tray && !tray.isDestroyed()) {
    updateTrayPresentation();
    return;
  }
  tray = new Tray(hearthIconPath());
  tray.on("click", () => revealMainWindow());
  updateTrayPresentation();
}

function destroyTray(): void {
  if (tray && !tray.isDestroyed()) tray.destroy();
  tray = null;
}

class CoreBroker {
  private child: UtilityProcess | null = null;
  private readonly pending = new Map<
    string,
    {
      resolve: (value: unknown) => void;
      reject: (reason: Error) => void;
      timeout: NodeJS.Timeout;
    }
  >();
  private readyPromise: Promise<void> = Promise.resolve();

  start(): void {
    if (this.child) {
      return;
    }

    let resolveReady: () => void = () => undefined;
    let rejectReady: (reason: Error) => void = () => undefined;
    this.readyPromise = new Promise<void>((resolve, reject) => {
      resolveReady = resolve;
      rejectReady = reject;
    });

    const corePath = path.join(__dirname, "../core/core.cjs");
    const dataDirectory =
      process.env.HEARTH_DATA_DIR || path.join(app.getPath("userData"), "data");
    const projectRoot =
      process.env.HEARTH_PROJECT_ROOT ||
      (app.isPackaged ? path.dirname(process.execPath) : app.getAppPath());

    this.child = utilityProcess.fork(corePath, [], {
      serviceName: "Hearth Local Core",
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...process.env,
        HEARTH_DATA_DIR: dataDirectory,
        HEARTH_PROJECT_ROOT: projectRoot,
        HEARTH_HOME_ROOT: process.env.HEARTH_HOME_ROOT || app.getPath("home"),
        NODE_NO_WARNINGS: "1"
      }
    });

    if (!app.isPackaged || process.env.HEARTH_DEBUG_CORE === "1") {
      this.child.stdout?.on("data", (chunk) => {
        console.log(`[hearth-core] ${String(chunk).trimEnd()}`);
      });
      this.child.stderr?.on("data", (chunk) => {
        console.error(`[hearth-core] ${String(chunk).trimEnd()}`);
      });
    }

    this.child.on("error", (type, location, report) => {
      const error = new Error(`The Hearth core encountered ${type} at ${location}. ${report}`);
      rejectReady(error);
    });

    this.child.on("message", (message: unknown) => {
      if (
        typeof message === "object" &&
        message !== null &&
        "type" in message &&
        message.type === "ready"
      ) {
        resolveReady();
        return;
      }
      if (
        typeof message === "object" &&
        message !== null &&
        "type" in message &&
        message.type === "living-room-event" &&
        "event" in message
      ) {
        if (
          mainWindow &&
          !mainWindow.isDestroyed() &&
          !mainWindow.webContents.isDestroyed()
        ) {
          mainWindow.webContents.send(
            "hearth:living-room-event",
            message.event as LivingRoomEvent
          );
        }
        return;
      }
      if (
        typeof message === "object" &&
        message !== null &&
        "type" in message &&
        message.type === "fatal"
      ) {
        const text =
          "message" in message && typeof message.message === "string"
            ? message.message
            : "The local core failed to start.";
        rejectReady(new Error(text));
        return;
      }
      if (
        typeof message === "object" &&
        message !== null &&
        "type" in message &&
        message.type === "terminal-event" &&
        "event" in message
      ) {
        const terminalEvent = message.event as TerminalEvent;
        if (terminalEvent.type === "observation") {
          if (terminalEvent.observation.requiresInput) {
            pendingWorkshopAttention = terminalEvent.observation.summary;
            notifications.workshopAttention(
              terminalEvent.observation.summary
            );
          } else {
            pendingWorkshopAttention = null;
            notifications.clearWorkshopAttention();
          }
          updateTrayPresentation();
        }
        if (
          mainWindow &&
          !mainWindow.isDestroyed() &&
          !mainWindow.webContents.isDestroyed()
        ) {
          mainWindow.webContents.send(
            "hearth:terminal-event",
            terminalEvent
          );
        }
        return;
      }
      if (
        typeof message === "object" &&
        message !== null &&
        "type" in message &&
        message.type === "agent-event" &&
        "event" in message
      ) {
        if (
          mainWindow &&
          !mainWindow.isDestroyed() &&
          !mainWindow.webContents.isDestroyed()
        ) {
          mainWindow.webContents.send(
            "hearth:agent-stream-event",
            message.event as AgentStreamEvent
          );
        }
        return;
      }

      const response = message as CoreResponse;
      const pending = this.pending.get(response.id);
      if (!pending) {
        return;
      }
      clearTimeout(pending.timeout);
      this.pending.delete(response.id);
      if (response.ok) {
        pending.resolve(response.result);
      } else {
        pending.reject(
          new Error(response.error?.message || "The local core returned an unknown error.")
        );
      }
    });

    this.child.on("exit", (code) => {
      this.child = null;
      const error = new Error(
        quitting
          ? "The Hearth core stopped."
          : `The Hearth core stopped unexpectedly (${code}).`
      );
      rejectReady(error);
      for (const pending of this.pending.values()) {
        clearTimeout(pending.timeout);
        pending.reject(error);
      }
      this.pending.clear();
    });
  }

  async invoke(method: CoreMethod, payload: unknown): Promise<unknown> {
    await this.readyPromise;
    if (!this.child) {
      throw new Error("The local core is not available.");
    }
    const id = randomUUID();
    const request = coreRequestSchema.parse({ id, method, payload });
    return new Promise((resolve, reject) => {
      const timeoutMs =
        method === "sendAgentMessage" || method === "sendLivingRoomMessage"
          ? 16 * 60_000
          : method === "configureMakerSession"
            ? 2 * 60_000
          : method === "createMakerProposal"
            ? 105_000
            : 15_000;
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`The local core timed out while handling ${method}.`));
      }, timeoutMs);
      this.pending.set(id, { resolve, reject, timeout });
      this.child?.postMessage(request);
    });
  }

  async stop(): Promise<void> {
    if (!this.child) {
      return;
    }
    const child = this.child;
    let timeout: NodeJS.Timeout | null = null;
    try {
      const snapshot = (await this.invoke("attachTerminal", {})) as TerminalSnapshot;
      if (
        snapshot.session &&
        ["starting", "running", "waiting"].includes(snapshot.session.lifecycle)
      ) {
        await this.invoke("stopTerminal", { sessionId: snapshot.session.id });
      }
      await Promise.race([
        this.invoke("shutdown", {}),
        new Promise((_, reject) => {
          timeout = setTimeout(
            () => reject(new Error("The Hearth core did not stop within five seconds.")),
            5_000
          );
        })
      ]);
    } catch {
      child.kill();
    } finally {
      if (timeout) {
        clearTimeout(timeout);
      }
    }
  }
}

const core = new CoreBroker();
const companion = new CompanionServer(
  async (method, payload) => {
    const result = await core.invoke(method, payload);
    const kind =
      method === "saveCapture"
        ? "capture"
        : method === "updateCapture"
          ? "decision"
        : method === "sendAgentMessage"
          ? "conversation"
          : null;
    if (kind && mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("hearth:companion-sync", {
        kind,
        createdAt: new Date().toISOString()
      });
    }
    if (kind === "capture") {
      notifications.phoneActivity("phone-capture");
    } else if (kind === "decision") {
      notifications.phoneActivity("phone-decision");
    }
    return result;
  },
  Number(process.env.HEARTH_COMPANION_PORT) || 47_831
);
const companionRemote = new CompanionRemoteTransport(
  Number(process.env.HEARTH_COMPANION_PORT) || 47_831,
  Number(process.env.HEARTH_COMPANION_HTTPS_PORT) || 8_443
);

function assertTrustedSender(event: IpcMainInvokeEvent): void {
  const sender = event.senderFrame?.url;
  if (!sender) {
    throw new Error("Hearth rejected a request without a trusted renderer frame.");
  }
  if (isDevelopment) {
    if (!sender.startsWith("http://127.0.0.1:5173")) {
      throw new Error("Hearth rejected a request from an untrusted renderer.");
    }
    return;
  }
  if (!sender.startsWith("file:")) {
    throw new Error("Hearth rejected a request from an untrusted renderer.");
  }
}

function registerIpc(): void {
  ipcMain.handle("hearth:bootstrap", (event) => {
    assertTrustedSender(event);
    return core.invoke("bootstrap", {});
  });
  ipcMain.handle("hearth:set-route", (event, route: Room) => {
    assertTrustedSender(event);
    return core.invoke("setRoute", { route });
  });
  ipcMain.handle(
    "hearth:send-agent-message",
    async (
      event,
      agent: AgentKey,
      text: string,
      surface?: "resident" | "workshop",
      libraryCaptureId?: string
    ) => {
      assertTrustedSender(event);
      const result = await core.invoke("sendAgentMessage", {
        agent,
        text,
        surface,
        libraryCaptureId
      });
      if (!(result as { cancelled?: boolean }).cancelled) {
        notifications.residentReply(
          agent[0]!.toLocaleUpperCase() + agent.slice(1),
          agent === "librarian"
            ? "library"
            : agent === "companion"
              ? "home"
              : "study"
        );
      }
      return result;
    }
  );
  ipcMain.handle(
    "hearth:create-living-room-discussion",
    (
      event,
      mode: LivingRoomMode,
      participants: AgentKey[],
      includeProject: boolean,
      context?: import("../shared/contracts").LivingRoomContext
    ) => {
      assertTrustedSender(event);
      return core.invoke("createLivingRoomDiscussion", {
        mode,
        participants,
        includeProject,
        context
      });
    }
  );
  ipcMain.handle("hearth:send-living-room-message", async (event, input) => {
    assertTrustedSender(event);
    const result = await core.invoke("sendLivingRoomMessage", input);
    if (!(result as { cancelled?: boolean }).cancelled) {
      notifications.residentReply("Living Room", "living");
    }
    return result;
  });
  ipcMain.handle(
    "hearth:archive-living-room-discussion",
    (event, threadId: string) => {
      assertTrustedSender(event);
      return core.invoke("archiveLivingRoomDiscussion", { threadId });
    }
  );
  ipcMain.handle(
    "hearth:restore-living-room-discussion",
    (event, threadId: string) => {
      assertTrustedSender(event);
      return core.invoke("restoreLivingRoomDiscussion", { threadId });
    }
  );
  ipcMain.handle(
    "hearth:rename-living-room-discussion",
    (event, threadId: string, title: string) => {
      assertTrustedSender(event);
      return core.invoke("renameLivingRoomDiscussion", { threadId, title });
    }
  );
  ipcMain.handle("hearth:cancel-living-room-discussion", (event) => {
    assertTrustedSender(event);
    return core.invoke("cancelLivingRoomDiscussion", {});
  });
  ipcMain.handle(
    "hearth:resolve-maker-permission",
    (event, permissionId: string, optionId: string) => {
      assertTrustedSender(event);
      return core.invoke("resolveMakerPermission", { permissionId, optionId });
    }
  );
  ipcMain.handle("hearth:configure-maker-session", (event, control) => {
    assertTrustedSender(event);
    return core.invoke("configureMakerSession", { control });
  });
  ipcMain.handle("hearth:reset-maker-session", (event) => {
    assertTrustedSender(event);
    return core.invoke("resetMakerSession", {});
  });
  ipcMain.handle(
    "hearth:set-agent-provider",
    (event, selection: AgentProviderSelection) => {
      assertTrustedSender(event);
      return core.invoke("setAgentProvider", { selection });
    }
  );
  ipcMain.handle("hearth:notification-status", (event) => {
    assertTrustedSender(event);
    return notifications.status();
  });
  ipcMain.handle(
    "hearth:set-notification-preferences",
    async (event, preferences: NotificationPreferences) => {
      assertTrustedSender(event);
      const saved = (await core.invoke("setNotificationPreferences", {
        preferences
      })) as NotificationPreferences;
      notifications.setPreferences(saved);
      if (pendingWorkshopAttention) {
        notifications.workshopAttention(pendingWorkshopAttention);
      }
      return notifications.status();
    }
  );
  ipcMain.handle(
    "hearth:cancel-agent-message",
    (event, agent: ReasoningAgent) => {
      assertTrustedSender(event);
      return core.invoke("cancelAgentMessage", { agent });
    }
  );
  ipcMain.handle("hearth:create-maker-proposal", (event, messageId: string) => {
    assertTrustedSender(event);
    return core.invoke("createMakerProposal", { messageId });
  });
  ipcMain.handle(
    "hearth:update-maker-proposal",
    (event, proposalId: string, instruction: string) => {
      assertTrustedSender(event);
      return core.invoke("updateMakerProposal", { proposalId, instruction });
    }
  );
  ipcMain.handle("hearth:discard-maker-proposal", (event, proposalId: string) => {
    assertTrustedSender(event);
    return core.invoke("discardMakerProposal", { proposalId });
  });
  ipcMain.handle("hearth:complete-maker-proposal", (event, proposalId: string) => {
    assertTrustedSender(event);
    return core.invoke("completeMakerProposal", { proposalId });
  });
  ipcMain.handle("hearth:close-maker-proposal", (event, proposalId: string) => {
    assertTrustedSender(event);
    return core.invoke("closeMakerProposal", { proposalId });
  });
  ipcMain.handle(
    "hearth:handoff-execution-result-to-critic",
    (event, proposalId: string) => {
      assertTrustedSender(event);
      return core.invoke("handoffExecutionResultToCritic", { proposalId });
    }
  );
  ipcMain.handle(
    "hearth:set-agent-context",
    (
      event,
      agent: ContextAgent,
      projectId: string,
      kind: AgentContextKind,
      projectPath?: string,
      projectPaths?: string[]
    ) => {
      assertTrustedSender(event);
      return core.invoke("setAgentContext", {
        agent,
        projectId,
        kind,
        path: projectPath,
        paths: projectPaths
      });
    }
  );
  ipcMain.handle(
    "hearth:save-capture",
    (event, text: string, kind?: "link" | "idea" | "note") => {
      assertTrustedSender(event);
      return core.invoke("saveCapture", { text, kind });
    }
  );
  ipcMain.handle(
    "hearth:update-capture",
    (event, captureId: string, patch: CapturePatch) => {
      assertTrustedSender(event);
      return core.invoke("updateCapture", { captureId, patch });
    }
  );
  ipcMain.handle(
    "hearth:search-captures",
    (
      event,
      query: string,
      kind?: "link" | "idea" | "note",
      limit?: number
    ) => {
      assertTrustedSender(event);
      return core.invoke("searchCaptures", { query, kind, limit });
    }
  );
  ipcMain.handle(
    "hearth:list-library-captures",
    (event, query: LibraryCaptureQuery) => {
      assertTrustedSender(event);
      return core.invoke("listLibraryCaptures", query);
    }
  );
  ipcMain.handle("hearth:inspect-personalos-stacks", (event) => {
    assertTrustedSender(event);
    return core.invoke("inspectPersonalOsStacks", {});
  });
  ipcMain.handle("hearth:import-personalos-stacks", (event) => {
    assertTrustedSender(event);
    return core.invoke("importPersonalOsStacks", {});
  });
  ipcMain.handle("hearth:get-archive", (event) => {
    assertTrustedSender(event);
    return core.invoke("getArchive", {});
  });
  ipcMain.handle(
    "hearth:remove-archive-item",
    (event, archiveId: string, kind: ArchiveKind) => {
      assertTrustedSender(event);
      return core.invoke("removeArchiveItem", { archiveId, kind });
    }
  );
  ipcMain.handle("hearth:get-idea-conversation", (event, captureId: string) => {
    assertTrustedSender(event);
    return core.invoke("getIdeaConversation", { captureId });
  });
  ipcMain.handle(
    "hearth:send-idea-message",
    async (event, captureId: string, text: string) => {
      assertTrustedSender(event);
      const result = await core.invoke("sendIdeaMessage", { captureId, text });
      if (!(result as { cancelled?: boolean }).cancelled) {
        notifications.residentReply("Maker", "studio");
      }
      return result;
    }
  );
  ipcMain.handle(
    "hearth:promote-idea",
    (event, captureId: string, target: IdeaPromotionTarget) => {
      assertTrustedSender(event);
      return core.invoke("promoteIdea", { captureId, target });
    }
  );
  ipcMain.handle("hearth:enrich-capture", (event, captureId: string) => {
    assertTrustedSender(event);
    return core.invoke("enrichCapture", { captureId });
  });
  ipcMain.handle("hearth:refresh-library-discovery", (event, force?: boolean) => {
    assertTrustedSender(event);
    return core.invoke("refreshLibraryDiscovery", { force });
  });
  ipcMain.handle(
    "hearth:set-library-discovery-feedback",
    (
      event,
      discoveryId: string,
      feedback: LibraryDiscoveryFeedback
    ) => {
      assertTrustedSender(event);
      return core.invoke("setLibraryDiscoveryFeedback", {
        discoveryId,
        feedback
      });
    }
  );
  ipcMain.handle(
    "hearth:save-house-memory",
    (event, input: HouseMemoryInput) => {
      assertTrustedSender(event);
      return core.invoke("saveHouseMemory", input);
    }
  );
  ipcMain.handle(
    "hearth:update-house-memory",
    (event, memoryId: string, patch: HouseMemoryPatch) => {
      assertTrustedSender(event);
      return core.invoke("updateHouseMemory", { memoryId, patch });
    }
  );
  ipcMain.handle(
    "hearth:forget-house-memory",
    (event, memoryId: string) => {
      assertTrustedSender(event);
      return core.invoke("forgetHouseMemory", { memoryId });
    }
  );
  ipcMain.handle("hearth:update-objective", (event, objective: string) => {
    assertTrustedSender(event);
    return core.invoke("updateObjective", { objective });
  });
  ipcMain.handle("hearth:leave-project", (event, note?: string) => {
    assertTrustedSender(event);
    return core.invoke("leaveProject", { note });
  });
  ipcMain.handle("hearth:create-backup", (event, reason: string) => {
    assertTrustedSender(event);
    return core.invoke("createBackup", { reason });
  });
  ipcMain.handle("hearth:list-workspace-projects", (event, refresh?: boolean) => {
    assertTrustedSender(event);
    return core.invoke("listWorkspaceProjects", { refresh });
  });
  ipcMain.handle("hearth:select-workspace-project", (event, projectId: string) => {
    assertTrustedSender(event);
    return core.invoke("selectWorkspaceProject", { projectId });
  });
  ipcMain.handle("hearth:get-workspace-project", (event, projectId: string) => {
    assertTrustedSender(event);
    return core.invoke("getWorkspaceProject", { projectId });
  });
  ipcMain.handle(
    "hearth:list-project-directory",
    (event, projectId: string, projectPath: string) => {
      assertTrustedSender(event);
      return core.invoke("listProjectDirectory", {
        projectId,
        path: projectPath
      });
    }
  );
  ipcMain.handle(
    "hearth:read-project-file",
    (event, projectId: string, projectPath: string) => {
      assertTrustedSender(event);
      return core.invoke("readProjectFile", {
        projectId,
        path: projectPath
      });
    }
  );
  ipcMain.handle(
    "hearth:search-project-files",
    (event, projectId: string, query: string) => {
      assertTrustedSender(event);
      return core.invoke("searchProjectFiles", { projectId, query });
    }
  );
  ipcMain.handle(
    "hearth:prepare-project-edit",
    (event, projectId: string, projectPath: string, text: string) => {
      assertTrustedSender(event);
      return core.invoke("prepareProjectEdit", {
        projectId,
        path: projectPath,
        text
      });
    }
  );
  ipcMain.handle(
    "hearth:propose-project-edit",
    (
      event,
      projectId: string,
      projectPath: string,
      instruction: string
    ) => {
      assertTrustedSender(event);
      return core.invoke("proposeProjectEdit", {
        projectId,
        path: projectPath,
        instruction
      });
    }
  );
  ipcMain.handle("hearth:critique-project-edit", (event, editId: string) => {
    assertTrustedSender(event);
    return core.invoke("critiqueProjectEdit", { editId });
  });
  ipcMain.handle("hearth:apply-project-edit", (event, editId: string) => {
    assertTrustedSender(event);
    return core.invoke("applyProjectEdit", { editId });
  });
  ipcMain.handle("hearth:list-project-edits", (event, projectId: string) => {
    assertTrustedSender(event);
    return core.invoke("listProjectEdits", { projectId });
  });
  ipcMain.handle("hearth:restore-project-edit", (event, editId: string) => {
    assertTrustedSender(event);
    return core.invoke("restoreProjectEdit", { editId });
  });
  ipcMain.handle(
    "hearth:read-project-diff",
    (event, projectId: string, projectPath?: string) => {
      assertTrustedSender(event);
      return core.invoke("readProjectDiff", {
        projectId,
        path: projectPath
      });
    }
  );
  ipcMain.handle("hearth:attach-terminal", (event) => {
    assertTrustedSender(event);
    return core.invoke("attachTerminal", {});
  });
  ipcMain.handle("hearth:detach-terminal", (event) => {
    assertTrustedSender(event);
    return core.invoke("detachTerminal", {});
  });
  ipcMain.handle(
    "hearth:start-terminal",
    (event, kind: TerminalKind, owner: TerminalOwner) => {
      assertTrustedSender(event);
      return core.invoke("startTerminal", { kind, owner });
    }
  );
  ipcMain.handle("hearth:resume-terminal", (event, owner: TerminalOwner) => {
    assertTrustedSender(event);
    return core.invoke("resumeTerminal", { owner });
  });
  ipcMain.handle(
    "hearth:terminal-input",
    (event, sessionId: string, data: string) => {
      assertTrustedSender(event);
      return core.invoke("terminalInput", { sessionId, data });
    }
  );
  ipcMain.handle(
    "hearth:terminal-instruction",
    (event, sessionId: string, proposalId: string, text: string) => {
      assertTrustedSender(event);
      return core.invoke("terminalInstruction", { sessionId, proposalId, text });
    }
  );
  ipcMain.handle(
    "hearth:terminal-resize",
    (event, sessionId: string, cols: number, rows: number) => {
      assertTrustedSender(event);
      return core.invoke("terminalResize", { sessionId, cols, rows });
    }
  );
  ipcMain.handle("hearth:stop-terminal", (event, sessionId: string) => {
    assertTrustedSender(event);
    return core.invoke("stopTerminal", { sessionId });
  });
  ipcMain.handle(
    "hearth:set-terminal-owner",
    (event, sessionId: string, owner: TerminalOwner) => {
      assertTrustedSender(event);
      return core.invoke("setTerminalOwner", { sessionId, owner });
    }
  );
  ipcMain.handle("hearth:open-external", async (event, candidate: string) => {
    assertTrustedSender(event);
    const url = new URL(candidate);
    if (!["http:", "https:"].includes(url.protocol)) {
      throw new Error("Hearth only opens HTTP or HTTPS links.");
    }
    await shell.openExternal(url.toString());
    return { opened: true };
  });
  ipcMain.handle("hearth:clipboard-read", (event) => {
    assertTrustedSender(event);
    return clipboard.readText().slice(0, 1_000_000);
  });
  ipcMain.handle("hearth:clipboard-write", async (event, text: string) => {
    assertTrustedSender(event);
    if (typeof text !== "string" || text.length > 1_000_000) {
      throw new Error("Clipboard text is too large.");
    }
    for (let attempt = 0; attempt < 5; attempt += 1) {
      clipboard.writeText(text);
      if (clipboard.readText() === text) {
        return { written: true };
      }
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    throw new Error("Windows did not make the clipboard available. Try copying again.");
  });
  ipcMain.handle("hearth:companion-status", (event) => {
    assertTrustedSender(event);
    return companion.status();
  });
  ipcMain.handle("hearth:companion-enabled", async (event, enabled: boolean) => {
    assertTrustedSender(event);
    if (typeof enabled !== "boolean") {
      throw new Error("Companion access requires an explicit on or off choice.");
    }
    if (enabled) {
      return companion.start();
    }
    await companionRemote.disable(false).catch(() => undefined);
    return companion.stop();
  });
  ipcMain.handle("hearth:companion-rotate", (event) => {
    assertTrustedSender(event);
    return companion.rotate();
  });
  ipcMain.handle("hearth:companion-remote-status", (event) => {
    assertTrustedSender(event);
    return companionRemote.status();
  });
  ipcMain.handle(
    "hearth:companion-remote-enabled",
    (event, enabled: boolean) => {
      assertTrustedSender(event);
      if (typeof enabled !== "boolean") {
        throw new Error(
          "Private Companion access requires an explicit on or off choice."
        );
      }
      return enabled
        ? companionRemote.enable(companion.status().state === "ready")
        : companionRemote.disable(true);
    }
  );
}

function configureSecurityHeaders(): void {
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const connectSource = isDevelopment
      ? "connect-src 'self' ws://127.0.0.1:5173 http://127.0.0.1:5173"
      : "connect-src 'self'";
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        "Content-Security-Policy": [
          `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; ${connectSource}; object-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'none'`
        ]
      }
    });
  });
}

async function createWindow(): Promise<void> {
  const iconPath = hearthIconPath();
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1040,
    minHeight: 700,
    show: false,
    icon: iconPath,
    backgroundColor: "#ece5da",
    title: "Hearth",
    autoHideMenuBar: true,
    titleBarStyle: "hidden",
    titleBarOverlay: {
      color: "#00000000",
      symbolColor: "#a9583b",
      height: 36
    },
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true
    }
  });

  if (process.platform === "win32") {
    mainWindow.setIcon(iconPath);
    mainWindow.setAppDetails({
      appId: windowsAppId,
      appIconPath: iconPath,
      appIconIndex: 0
    });
  }
  mainWindow.setMenuBarVisibility(false);
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  mainWindow.webContents.on("will-navigate", (event) => {
    event.preventDefault();
  });
  mainWindow.once("ready-to-show", () => {
    mainWindow?.show();
  });
  mainWindow.on("minimize", () => {
    if (pendingWorkshopAttention) {
      notifications.workshopAttention(pendingWorkshopAttention);
    }
  });
  mainWindow.on("close", (event) => {
    if (!quitting) {
      event.preventDefault();
      mainWindow?.hide();
      updateTrayPresentation();
    }
  });
  mainWindow.once("closed", () => {
    mainWindow = null;
  });

  if (isDevelopment && process.env.VITE_DEV_SERVER_URL) {
    await mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    await mainWindow.loadFile(path.join(__dirname, "../../dist-renderer/index.html"));
  }
}

app.whenReady().then(async () => {
  if (!ownsPrimaryInstance) return;
  core.start();
  registerIpc();
  configureSecurityHeaders();
  const savedNotificationPreferences = (await core
    .invoke("getNotificationPreferences", {})
    .catch(() => DEFAULT_NOTIFICATION_PREFERENCES)) as NotificationPreferences;
  notifications.setPreferences(savedNotificationPreferences);
  ensureTray();
  await createWindow();

  app.on("activate", async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createWindow();
    } else {
      revealMainWindow();
    }
  });
});

app.on("before-quit", (event) => {
  if (!ownsPrimaryInstance) {
    return;
  }
  if (quitting) {
    return;
  }
  event.preventDefault();
  quitting = true;
  destroyTray();
  void companionRemote
    .disable(false)
    .catch(() => undefined)
    .then(() => companion.stop())
    .then(() => core.stop())
    .finally(() => {
      app.quit();
    });
});

app.on("window-all-closed", () => {
  // Hearth remains available from the tray until Quit Hearth is chosen.
});
