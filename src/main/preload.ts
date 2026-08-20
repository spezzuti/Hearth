import { contextBridge, ipcRenderer } from "electron";
import type {
  AgentContextKind,
  AgentKey,
  AgentProviderSelection,
  AgentSurface,
  AgentStreamEvent,
  ArchiveKind,
  CapturePatch,
  CompanionSyncEvent,
  ContextAgent,
  NotificationPreferences,
  HearthApi,
  HouseMemoryInput,
  HouseMemoryPatch,
  IdeaPromotionTarget,
  LibraryCaptureQuery,
  LibraryDiscoveryFeedback,
  LivingRoomEvent,
  LivingRoomMode,
  MakerSessionControl,
  ReasoningAgent,
  Room,
  TerminalEvent,
  TerminalKind,
  TerminalOwner
} from "../shared/contracts";

const api: HearthApi = {
  bootstrap: () => ipcRenderer.invoke("hearth:bootstrap"),
  setRoute: (route: Room) => ipcRenderer.invoke("hearth:set-route", route),
  sendAgentMessage: (
    agent: AgentKey,
    text: string,
    surface?: AgentSurface,
    libraryCaptureId?: string
  ) =>
    ipcRenderer.invoke(
      "hearth:send-agent-message",
      agent,
      text,
      surface,
      libraryCaptureId
    ),
  createLivingRoomDiscussion: (
    mode: LivingRoomMode,
    participants: AgentKey[],
    includeProject: boolean,
    context?: import("../shared/contracts").LivingRoomContext
  ) =>
    ipcRenderer.invoke(
      "hearth:create-living-room-discussion",
      mode,
      participants,
      includeProject,
      context
    ),
  sendLivingRoomMessage: (input) =>
    ipcRenderer.invoke("hearth:send-living-room-message", input),
  archiveLivingRoomDiscussion: (threadId: string) =>
    ipcRenderer.invoke("hearth:archive-living-room-discussion", threadId),
  restoreLivingRoomDiscussion: (threadId: string) =>
    ipcRenderer.invoke("hearth:restore-living-room-discussion", threadId),
  renameLivingRoomDiscussion: (threadId: string, title: string) =>
    ipcRenderer.invoke("hearth:rename-living-room-discussion", threadId, title),
  cancelLivingRoomDiscussion: () =>
    ipcRenderer.invoke("hearth:cancel-living-room-discussion"),
  resolveMakerPermission: (permissionId: string, optionId: string) =>
    ipcRenderer.invoke("hearth:resolve-maker-permission", permissionId, optionId),
  configureMakerSession: (control: MakerSessionControl) =>
    ipcRenderer.invoke("hearth:configure-maker-session", control),
  resetMakerSession: () => ipcRenderer.invoke("hearth:reset-maker-session"),
  setAgentProvider: (selection: AgentProviderSelection) =>
    ipcRenderer.invoke("hearth:set-agent-provider", selection),
  getNotificationStatus: () =>
    ipcRenderer.invoke("hearth:notification-status"),
  setNotificationPreferences: (preferences: NotificationPreferences) =>
    ipcRenderer.invoke("hearth:set-notification-preferences", preferences),
  cancelAgentMessage: (agent: ReasoningAgent) =>
    ipcRenderer.invoke("hearth:cancel-agent-message", agent),
  createMakerProposal: (messageId: string) =>
    ipcRenderer.invoke("hearth:create-maker-proposal", messageId),
  updateMakerProposal: (proposalId: string, instruction: string) =>
    ipcRenderer.invoke("hearth:update-maker-proposal", proposalId, instruction),
  discardMakerProposal: (proposalId: string) =>
    ipcRenderer.invoke("hearth:discard-maker-proposal", proposalId),
  completeMakerProposal: (proposalId: string) =>
    ipcRenderer.invoke("hearth:complete-maker-proposal", proposalId),
  closeMakerProposal: (proposalId: string) =>
    ipcRenderer.invoke("hearth:close-maker-proposal", proposalId),
  handoffExecutionResultToCritic: (proposalId: string) =>
    ipcRenderer.invoke("hearth:handoff-execution-result-to-critic", proposalId),
  setAgentContext: (
    agent: ContextAgent,
    projectId: string,
    kind: AgentContextKind,
    projectPath?: string,
    projectPaths?: string[]
  ) =>
    ipcRenderer.invoke(
      "hearth:set-agent-context",
      agent,
      projectId,
      kind,
      projectPath,
      projectPaths
    ),
  saveCapture: (text: string, kind?: "link" | "idea" | "note") =>
    ipcRenderer.invoke("hearth:save-capture", text, kind),
  updateCapture: (captureId: string, patch: CapturePatch) =>
    ipcRenderer.invoke("hearth:update-capture", captureId, patch),
  searchCaptures: (
    query: string,
    kind?: "link" | "idea" | "note",
    limit?: number
  ) => ipcRenderer.invoke("hearth:search-captures", query, kind, limit),
  listLibraryCaptures: (query: LibraryCaptureQuery) =>
    ipcRenderer.invoke("hearth:list-library-captures", query),
  inspectPersonalOsStacks: () =>
    ipcRenderer.invoke("hearth:inspect-personalos-stacks"),
  importPersonalOsStacks: () =>
    ipcRenderer.invoke("hearth:import-personalos-stacks"),
  getArchive: () => ipcRenderer.invoke("hearth:get-archive"),
  removeArchiveItem: (archiveId: string, kind: ArchiveKind) =>
    ipcRenderer.invoke("hearth:remove-archive-item", archiveId, kind),
  getIdeaConversation: (captureId: string) =>
    ipcRenderer.invoke("hearth:get-idea-conversation", captureId),
  sendIdeaMessage: (captureId: string, text: string) =>
    ipcRenderer.invoke("hearth:send-idea-message", captureId, text),
  promoteIdea: (captureId: string, target: IdeaPromotionTarget) =>
    ipcRenderer.invoke("hearth:promote-idea", captureId, target),
  enrichCapture: (captureId: string) =>
    ipcRenderer.invoke("hearth:enrich-capture", captureId),
  refreshLibraryDiscovery: (force?: boolean) =>
    ipcRenderer.invoke("hearth:refresh-library-discovery", force),
  setLibraryDiscoveryFeedback: (
    discoveryId: string,
    feedback: LibraryDiscoveryFeedback
  ) =>
    ipcRenderer.invoke(
      "hearth:set-library-discovery-feedback",
      discoveryId,
      feedback
    ),
  saveHouseMemory: (input: HouseMemoryInput) =>
    ipcRenderer.invoke("hearth:save-house-memory", input),
  updateHouseMemory: (memoryId: string, patch: HouseMemoryPatch) =>
    ipcRenderer.invoke("hearth:update-house-memory", memoryId, patch),
  forgetHouseMemory: (memoryId: string) =>
    ipcRenderer.invoke("hearth:forget-house-memory", memoryId),
  updateObjective: (objective: string) =>
    ipcRenderer.invoke("hearth:update-objective", objective),
  leaveProject: (note?: string) =>
    ipcRenderer.invoke("hearth:leave-project", note),
  createBackup: (reason: string) =>
    ipcRenderer.invoke("hearth:create-backup", reason),
  listWorkspaceProjects: (refresh?: boolean) =>
    ipcRenderer.invoke("hearth:list-workspace-projects", refresh),
  selectWorkspaceProject: (projectId: string) =>
    ipcRenderer.invoke("hearth:select-workspace-project", projectId),
  activateWorkspaceProject: (projectId: string) =>
    ipcRenderer.invoke("hearth:activate-workspace-project", projectId),
  getWorkspaceProject: (projectId: string) =>
    ipcRenderer.invoke("hearth:get-workspace-project", projectId),
  listProjectDirectory: (projectId: string, projectPath: string) =>
    ipcRenderer.invoke("hearth:list-project-directory", projectId, projectPath),
  readProjectFile: (projectId: string, projectPath: string) =>
    ipcRenderer.invoke("hearth:read-project-file", projectId, projectPath),
  searchProjectFiles: (projectId: string, query: string) =>
    ipcRenderer.invoke("hearth:search-project-files", projectId, query),
  prepareProjectEdit: (
    projectId: string,
    projectPath: string,
    text: string
  ) =>
    ipcRenderer.invoke(
      "hearth:prepare-project-edit",
      projectId,
      projectPath,
      text
    ),
  proposeProjectEdit: (
    projectId: string,
    projectPath: string,
    instruction: string
  ) =>
    ipcRenderer.invoke(
      "hearth:propose-project-edit",
      projectId,
      projectPath,
      instruction
    ),
  critiqueProjectEdit: (editId: string) =>
    ipcRenderer.invoke("hearth:critique-project-edit", editId),
  applyProjectEdit: (editId: string) =>
    ipcRenderer.invoke("hearth:apply-project-edit", editId),
  listProjectEdits: (projectId: string) =>
    ipcRenderer.invoke("hearth:list-project-edits", projectId),
  restoreProjectEdit: (editId: string) =>
    ipcRenderer.invoke("hearth:restore-project-edit", editId),
  readProjectDiff: (projectId: string, projectPath?: string) =>
    ipcRenderer.invoke("hearth:read-project-diff", projectId, projectPath),
  attachTerminal: () => ipcRenderer.invoke("hearth:attach-terminal"),
  detachTerminal: () => ipcRenderer.invoke("hearth:detach-terminal"),
  setTerminalKeyboardFocus: (sessionId: string | null) =>
    ipcRenderer.invoke("hearth:set-terminal-keyboard-focus", sessionId),
  startTerminal: (kind: TerminalKind, owner: TerminalOwner) =>
    ipcRenderer.invoke("hearth:start-terminal", kind, owner),
  resumeTerminal: (owner: TerminalOwner) =>
    ipcRenderer.invoke("hearth:resume-terminal", owner),
  terminalInput: (sessionId: string, data: string) =>
    ipcRenderer.invoke("hearth:terminal-input", sessionId, data),
  terminalInstruction: (sessionId: string, proposalId: string, text: string) =>
    ipcRenderer.invoke("hearth:terminal-instruction", sessionId, proposalId, text),
  terminalResize: (sessionId: string, cols: number, rows: number) =>
    ipcRenderer.invoke("hearth:terminal-resize", sessionId, cols, rows),
  stopTerminal: (sessionId: string) =>
    ipcRenderer.invoke("hearth:stop-terminal", sessionId),
  setTerminalOwner: (sessionId: string, owner: TerminalOwner) =>
    ipcRenderer.invoke("hearth:set-terminal-owner", sessionId, owner),
  onTerminalEvent: (listener: (event: TerminalEvent) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, terminalEvent: TerminalEvent) => {
      listener(terminalEvent);
    };
    ipcRenderer.on("hearth:terminal-event", handler);
    return () => ipcRenderer.removeListener("hearth:terminal-event", handler);
  },
  onAgentStreamEvent: (listener: (event: AgentStreamEvent) => void) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      agentEvent: AgentStreamEvent
    ) => {
      listener(agentEvent);
    };
    ipcRenderer.on("hearth:agent-stream-event", handler);
    return () =>
      ipcRenderer.removeListener("hearth:agent-stream-event", handler);
  },
  onLivingRoomEvent: (listener: (event: LivingRoomEvent) => void) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      livingRoomEvent: LivingRoomEvent
    ) => listener(livingRoomEvent);
    ipcRenderer.on("hearth:living-room-event", handler);
    return () =>
      ipcRenderer.removeListener("hearth:living-room-event", handler);
  },
  openExternal: (url: string) => ipcRenderer.invoke("hearth:open-external", url),
  readClipboard: () => ipcRenderer.invoke("hearth:clipboard-read"),
  writeClipboard: (text: string) =>
    ipcRenderer.invoke("hearth:clipboard-write", text),
  getCompanionAccess: () => ipcRenderer.invoke("hearth:companion-status"),
  setCompanionAccess: (enabled: boolean) =>
    ipcRenderer.invoke("hearth:companion-enabled", enabled),
  rotateCompanionPairing: () =>
    ipcRenderer.invoke("hearth:companion-rotate"),
  getCompanionRemoteAccess: () =>
    ipcRenderer.invoke("hearth:companion-remote-status"),
  setCompanionRemoteAccess: (enabled: boolean) =>
    ipcRenderer.invoke("hearth:companion-remote-enabled", enabled),
  onCompanionSync: (listener: (event: CompanionSyncEvent) => void) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      syncEvent: CompanionSyncEvent
    ) => listener(syncEvent);
    ipcRenderer.on("hearth:companion-sync", handler);
    return () =>
      ipcRenderer.removeListener("hearth:companion-sync", handler);
  },
  onNotificationNavigation: (listener) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      room: Parameters<typeof listener>[0]
    ) => listener(room);
    ipcRenderer.on("hearth:notification-navigation", handler);
    return () =>
      ipcRenderer.removeListener("hearth:notification-navigation", handler);
  },
  platform: "win32"
};

contextBridge.exposeInMainWorld("hearth", api);
