import { z } from "zod";

export const roomSchema = z.enum([
  "home",
  "living",
  "study",
  "workshop",
  "library",
  "studio",
  "archive"
]);
export type Room = z.infer<typeof roomSchema>;

export const agentSchema = z.enum(["maker", "companion", "critic", "librarian"]);
export type AgentKey = z.infer<typeof agentSchema>;

export const contextAgentSchema = z.enum(["maker", "critic"]);
export type ContextAgent = z.infer<typeof contextAgentSchema>;

export const reasoningAgentSchema = z.enum([
  "maker",
  "companion",
  "critic",
  "librarian"
]);
export type ReasoningAgent = z.infer<typeof reasoningAgentSchema>;

export const agentProviderSelectionSchema = z.enum(["claude-code", "local"]);
export type AgentProviderSelection = z.infer<typeof agentProviderSelectionSchema>;

export const agentSurfaceSchema = z.enum(["resident", "workshop"]);
export type AgentSurface = z.infer<typeof agentSurfaceSchema>;

export const livingRoomModeSchema = z.enum([
  "conversation",
  "roundtable",
  "challenge"
]);
export type LivingRoomMode = z.infer<typeof livingRoomModeSchema>;
export const livingRoomContextSchema = z.object({
  kind: z.enum(["house", "project", "maker", "critic", "library", "studio", "workshop"]),
  label: z.string().trim().min(1).max(160),
  summary: z.string().trim().min(1).max(4_000),
  sourceId: z.string().trim().max(2_000).nullable().optional()
});

export interface NotificationPreferences {
  workshopAttention: boolean;
  residentReplies: boolean;
  phoneActivity: boolean;
}

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  workshopAttention: true,
  residentReplies: true,
  phoneActivity: false
};

export type DesktopNotificationKind =
  | "workshop-attention"
  | "resident-reply"
  | "phone-capture"
  | "phone-decision";

export interface DesktopNotificationStatus {
  supported: boolean;
  preferences: NotificationPreferences;
  lastDelivery: {
    kind: DesktopNotificationKind;
    room: Room;
    createdAt: string;
  } | null;
}

export const libraryDiscoveryFeedbackSchema = z.enum(["none", "kept", "dismissed"]);
export type LibraryDiscoveryFeedback = z.infer<typeof libraryDiscoveryFeedbackSchema>;

export const houseMemoryKindSchema = z.enum([
  "preference",
  "workflow",
  "tool",
  "project",
  "resident"
]);
export type HouseMemoryKind = z.infer<typeof houseMemoryKindSchema>;

export const houseMemoryScopeSchema = z.enum(["house", "project", "resident"]);
export type HouseMemoryScope = z.infer<typeof houseMemoryScopeSchema>;

export const houseMemoryStateSchema = z.enum([
  "active",
  "suggested",
  "dismissed"
]);
export type HouseMemoryState = z.infer<typeof houseMemoryStateSchema>;

export const agentContextKindSchema = z.enum(["project", "file", "diff", "evidence"]);
export type AgentContextKind = z.infer<typeof agentContextKindSchema>;

export const makerProposalRiskSchema = z.enum(["low", "medium", "high", "unknown"]);
export type MakerProposalRisk = z.infer<typeof makerProposalRiskSchema>;

export const projectEditCritiqueVerdictSchema = z.enum([
  "support",
  "caution",
  "object"
]);
export type ProjectEditCritiqueVerdict = z.infer<
  typeof projectEditCritiqueVerdictSchema
>;

export const terminalKindSchema = z.enum(["powershell", "claude"]);
export type TerminalKind = z.infer<typeof terminalKindSchema>;

export const terminalOwnerSchema = z.enum(["user", "maker"]);
export type TerminalOwner = z.infer<typeof terminalOwnerSchema>;

export const terminalLifecycleSchema = z.enum([
  "idle",
  "starting",
  "running",
  "waiting",
  "stopped",
  "failed"
]);
export type TerminalLifecycle = z.infer<typeof terminalLifecycleSchema>;

export type TerminalObservationState =
  | "quiet"
  | "ready"
  | "working"
  | "attention"
  | "failed";

export const coreRequestSchema = z.discriminatedUnion("method", [
  z.object({
    id: z.string().min(1),
    method: z.literal("bootstrap"),
    payload: z.object({})
  }),
  z.object({
    id: z.string().min(1),
    method: z.literal("setRoute"),
    payload: z.object({ route: roomSchema })
  }),
  z.object({
    id: z.string().min(1),
    method: z.literal("sendAgentMessage"),
    payload: z.object({
      agent: agentSchema,
      text: z.string().trim().min(1).max(8_000),
      surface: agentSurfaceSchema.optional(),
      libraryCaptureId: z.string().uuid().optional()
    })
  }),
  z.object({
    id: z.string().min(1),
    method: z.literal("createLivingRoomDiscussion"),
    payload: z.object({
      mode: livingRoomModeSchema,
      participants: z.array(agentSchema).min(1).max(4),
      includeProject: z.boolean(),
      context: livingRoomContextSchema.optional()
    })
  }),
  z.object({
    id: z.string().min(1),
    method: z.literal("sendLivingRoomMessage"),
    payload: z.object({
      threadId: z.string().uuid(),
      text: z.string().trim().min(1).max(8_000),
      mode: livingRoomModeSchema,
      participants: z.array(agentSchema).min(1).max(4),
      includeProject: z.boolean()
    })
  }),
  z.object({
    id: z.string().min(1),
    method: z.literal("archiveLivingRoomDiscussion"),
    payload: z.object({ threadId: z.string().uuid() })
  }),
  z.object({
    id: z.string().min(1),
    method: z.literal("restoreLivingRoomDiscussion"),
    payload: z.object({ threadId: z.string().uuid() })
  }),
  z.object({
    id: z.string().min(1),
    method: z.literal("renameLivingRoomDiscussion"),
    payload: z.object({
      threadId: z.string().uuid(),
      title: z.string().trim().min(1).max(120)
    })
  }),
  z.object({
    id: z.string().min(1),
    method: z.literal("cancelLivingRoomDiscussion"),
    payload: z.object({})
  }),
  z.object({
    id: z.string().min(1),
    method: z.literal("resolveMakerPermission"),
    payload: z.object({
      permissionId: z.string().uuid(),
      optionId: z.string().min(1).max(200)
    })
  }),
  z.object({
    id: z.string().min(1),
    method: z.literal("configureMakerSession"),
    payload: z.object({
      control: z.discriminatedUnion("kind", [
        z.object({ kind: z.literal("mode"), value: z.string().trim().min(1).max(100).optional() }),
        z.object({ kind: z.literal("effort"), value: z.string().trim().min(1).max(100).optional() })
      ])
    })
  }),
  z.object({
    id: z.string().min(1),
    method: z.literal("resetMakerSession"),
    payload: z.object({})
  }),
  z.object({
    id: z.string().min(1),
    method: z.literal("setAgentProvider"),
    payload: z.object({
      selection: agentProviderSelectionSchema
    })
  }),
  z.object({
    id: z.string().min(1),
    method: z.literal("getNotificationPreferences"),
    payload: z.object({})
  }),
  z.object({
    id: z.string().min(1),
    method: z.literal("setNotificationPreferences"),
    payload: z.object({
      preferences: z.object({
        workshopAttention: z.boolean(),
        residentReplies: z.boolean(),
        phoneActivity: z.boolean()
      })
    })
  }),
  z.object({
    id: z.string().min(1),
    method: z.literal("cancelAgentMessage"),
    payload: z.object({
      agent: reasoningAgentSchema
    })
  }),
  z.object({
    id: z.string().min(1),
    method: z.literal("createMakerProposal"),
    payload: z.object({
      messageId: z.string().min(1).max(120)
    })
  }),
  z.object({
    id: z.string().min(1),
    method: z.literal("updateMakerProposal"),
    payload: z.object({
      proposalId: z.string().min(1).max(120),
      instruction: z.string().trim().min(1).max(8_000)
    })
  }),
  z.object({
    id: z.string().min(1),
    method: z.literal("discardMakerProposal"),
    payload: z.object({
      proposalId: z.string().min(1).max(120)
    })
  }),
  z.object({
    id: z.string().min(1),
    method: z.literal("completeMakerProposal"),
    payload: z.object({
      proposalId: z.string().min(1).max(120)
    })
  }),
  z.object({
    id: z.string().min(1),
    method: z.literal("closeMakerProposal"),
    payload: z.object({
      proposalId: z.string().min(1).max(120)
    })
  }),
  z.object({
    id: z.string().min(1),
    method: z.literal("handoffExecutionResultToCritic"),
    payload: z.object({
      proposalId: z.string().min(1).max(120)
    })
  }),
  z.object({
    id: z.string().min(1),
    method: z.literal("setAgentContext"),
    payload: z.object({
      agent: contextAgentSchema,
      projectId: z.string().min(1).max(120),
      kind: agentContextKindSchema,
      path: z.string().max(2_000).optional(),
      paths: z.array(z.string().min(1).max(2_000)).max(6).optional()
    })
  }),
  z.object({
    id: z.string().min(1),
    method: z.literal("saveCapture"),
    payload: z.object({
      text: z.string().trim().min(1).max(12_000),
      kind: z.enum(["link", "idea", "note"]).optional()
    })
  }),
  z.object({
    id: z.string().min(1),
    method: z.literal("updateCapture"),
    payload: z.object({
      captureId: z.string().uuid(),
      patch: z.object({
        title: z.string().trim().max(300).nullable().optional(),
        description: z.string().trim().max(2_000).nullable().optional(),
        tags: z.array(z.string().trim().min(1).max(32)).max(8).optional(),
        libraryCollection: z.string().trim().max(80).nullable().optional(),
        pinned: z.boolean().optional(),
        archived: z.boolean().optional(),
        ideaState: z.enum(["resting", "pursuing", "let-go"]).optional(),
        workspaceProjectId: z.string().min(1).max(120).nullable().optional()
      })
    })
  }),
  z.object({
    id: z.string().min(1),
    method: z.literal("searchCaptures"),
    payload: z.object({
      query: z.string().trim().max(500),
      kind: z.enum(["link", "idea", "note"]).optional(),
      limit: z.number().int().min(1).max(200).optional()
    })
  }),
  z.object({
    id: z.string().min(1),
    method: z.literal("listLibraryCaptures"),
    payload: z.object({
      query: z.string().trim().max(500),
      shelf: z.enum(["all", "pinned", "archive"]),
      collection: z.string().trim().max(80).nullable(),
      sort: z.enum(["saved", "updated", "title", "collection"]),
      offset: z.number().int().min(0),
      limit: z.number().int().min(1).max(100)
    })
  }),
  z.object({
    id: z.string().min(1),
    method: z.literal("inspectPersonalOsStacks"),
    payload: z.object({})
  }),
  z.object({
    id: z.string().min(1),
    method: z.literal("importPersonalOsStacks"),
    payload: z.object({})
  }),
  z.object({
    id: z.string().min(1),
    method: z.literal("getArchive"),
    payload: z.object({})
  }),
  z.object({
    id: z.string().min(1),
    method: z.literal("removeArchiveItem"),
    payload: z.object({
      archiveId: z.string().uuid(),
      kind: z.enum(["return-pack", "library", "idea", "handoff", "edit"])
    })
  }),
  z.object({
    id: z.string().min(1),
    method: z.literal("getIdeaConversation"),
    payload: z.object({
      captureId: z.string().uuid()
    })
  }),
  z.object({
    id: z.string().min(1),
    method: z.literal("sendIdeaMessage"),
    payload: z.object({
      captureId: z.string().uuid(),
      text: z.string().trim().min(1).max(8_000)
    })
  }),
  z.object({
    id: z.string().min(1),
    method: z.literal("promoteIdea"),
    payload: z.object({
      captureId: z.string().uuid(),
      target: z.discriminatedUnion("kind", [
        z.object({
          kind: z.literal("existing"),
          projectId: z.string().min(1).max(120)
        }),
        z.object({
          kind: z.literal("new"),
          name: z.string().trim().min(1).max(100)
        })
      ])
    })
  }),
  z.object({
    id: z.string().min(1),
    method: z.literal("enrichCapture"),
    payload: z.object({
      captureId: z.string().uuid()
    })
  }),
  z.object({
    id: z.string().min(1),
    method: z.literal("refreshLibraryDiscovery"),
    payload: z.object({
      force: z.boolean().optional()
    })
  }),
  z.object({
    id: z.string().min(1),
    method: z.literal("setLibraryDiscoveryFeedback"),
    payload: z.object({
      discoveryId: z.string().min(1).max(120),
      feedback: libraryDiscoveryFeedbackSchema
    })
  }),
  z.object({
    id: z.string().min(1),
    method: z.literal("saveHouseMemory"),
    payload: z.object({
      kind: houseMemoryKindSchema,
      scope: houseMemoryScopeSchema,
      subjectId: z.string().trim().min(1).max(2_000).nullable().optional(),
      subjectLabel: z.string().trim().min(1).max(120).nullable().optional(),
      text: z.string().trim().min(1).max(600)
    })
  }),
  z.object({
    id: z.string().min(1),
    method: z.literal("updateHouseMemory"),
    payload: z.object({
      memoryId: z.string().uuid(),
      patch: z.object({
        kind: houseMemoryKindSchema.optional(),
        scope: houseMemoryScopeSchema.optional(),
        subjectId: z.string().trim().min(1).max(2_000).nullable().optional(),
        subjectLabel: z.string().trim().min(1).max(120).nullable().optional(),
        text: z.string().trim().min(1).max(600).optional(),
        state: houseMemoryStateSchema.optional()
      })
    })
  }),
  z.object({
    id: z.string().min(1),
    method: z.literal("forgetHouseMemory"),
    payload: z.object({
      memoryId: z.string().uuid()
    })
  }),
  z.object({
    id: z.string().min(1),
    method: z.literal("updateObjective"),
    payload: z.object({
      objective: z.string().trim().min(1).max(2_000)
    })
  }),
  z.object({
    id: z.string().min(1),
    method: z.literal("leaveProject"),
    payload: z.object({
      note: z.string().trim().max(4_000).optional()
    })
  }),
  z.object({
    id: z.string().min(1),
    method: z.literal("createBackup"),
    payload: z.object({
      reason: z.string().trim().min(1).max(120)
    })
  }),
  z.object({
    id: z.string().min(1),
    method: z.literal("listWorkspaceProjects"),
    payload: z.object({
      refresh: z.boolean().optional()
    })
  }),
  z.object({
    id: z.string().min(1),
    method: z.literal("selectWorkspaceProject"),
    payload: z.object({
      projectId: z.string().min(1).max(120)
    })
  }),
  z.object({
    id: z.string().min(1),
    method: z.literal("getWorkspaceProject"),
    payload: z.object({
      projectId: z.string().min(1).max(120)
    })
  }),
  z.object({
    id: z.string().min(1),
    method: z.literal("listProjectDirectory"),
    payload: z.object({
      projectId: z.string().min(1).max(120),
      path: z.string().max(2_000)
    })
  }),
  z.object({
    id: z.string().min(1),
    method: z.literal("readProjectFile"),
    payload: z.object({
      projectId: z.string().min(1).max(120),
      path: z.string().min(1).max(2_000)
    })
  }),
  z.object({
    id: z.string().min(1),
    method: z.literal("searchProjectFiles"),
    payload: z.object({
      projectId: z.string().min(1).max(120),
      query: z.string().trim().min(2).max(120)
    })
  }),
  z.object({
    id: z.string().min(1),
    method: z.literal("prepareProjectEdit"),
    payload: z.object({
      projectId: z.string().min(1).max(120),
      path: z.string().min(1).max(2_000),
      text: z.string().max(150_000)
    })
  }),
  z.object({
    id: z.string().min(1),
    method: z.literal("proposeProjectEdit"),
    payload: z.object({
      projectId: z.string().min(1).max(120),
      path: z.string().min(1).max(2_000),
      instruction: z.string().trim().min(1).max(2_000)
    })
  }),
  z.object({
    id: z.string().min(1),
    method: z.literal("critiqueProjectEdit"),
    payload: z.object({
      editId: z.string().uuid()
    })
  }),
  z.object({
    id: z.string().min(1),
    method: z.literal("applyProjectEdit"),
    payload: z.object({
      editId: z.string().uuid()
    })
  }),
  z.object({
    id: z.string().min(1),
    method: z.literal("listProjectEdits"),
    payload: z.object({
      projectId: z.string().min(1).max(120)
    })
  }),
  z.object({
    id: z.string().min(1),
    method: z.literal("restoreProjectEdit"),
    payload: z.object({
      editId: z.string().uuid()
    })
  }),
  z.object({
    id: z.string().min(1),
    method: z.literal("readProjectDiff"),
    payload: z.object({
      projectId: z.string().min(1).max(120),
      path: z.string().max(2_000).optional()
    })
  }),
  z.object({
    id: z.string().min(1),
    method: z.literal("attachTerminal"),
    payload: z.object({})
  }),
  z.object({
    id: z.string().min(1),
    method: z.literal("detachTerminal"),
    payload: z.object({})
  }),
  z.object({
    id: z.string().min(1),
    method: z.literal("startTerminal"),
    payload: z.object({
      kind: terminalKindSchema,
      owner: terminalOwnerSchema
    })
  }),
  z.object({
    id: z.string().min(1),
    method: z.literal("resumeTerminal"),
    payload: z.object({
      owner: terminalOwnerSchema
    })
  }),
  z.object({
    id: z.string().min(1),
    method: z.literal("terminalInput"),
    payload: z.object({
      sessionId: z.string().uuid(),
      data: z.string().max(65_536)
    })
  }),
  z.object({
    id: z.string().min(1),
    method: z.literal("terminalInstruction"),
    payload: z.object({
      sessionId: z.string().uuid(),
      proposalId: z.string().min(1).max(120),
      text: z.string().trim().min(1).max(8_000)
    })
  }),
  z.object({
    id: z.string().min(1),
    method: z.literal("terminalResize"),
    payload: z.object({
      sessionId: z.string().uuid(),
      cols: z.number().int().min(20).max(400),
      rows: z.number().int().min(5).max(200)
    })
  }),
  z.object({
    id: z.string().min(1),
    method: z.literal("stopTerminal"),
    payload: z.object({
      sessionId: z.string().uuid()
    })
  }),
  z.object({
    id: z.string().min(1),
    method: z.literal("setTerminalOwner"),
    payload: z.object({
      sessionId: z.string().uuid(),
      owner: terminalOwnerSchema
    })
  }),
  z.object({
    id: z.string().min(1),
    method: z.literal("shutdown"),
    payload: z.object({})
  })
]);

export type CoreRequest = z.infer<typeof coreRequestSchema>;
export type CoreMethod = CoreRequest["method"];

export interface ProjectRecord {
  id: string;
  name: string;
  rootPath: string;
  status: "active" | "resting" | "archived";
  updatedAt: string;
}

export interface ProjectState {
  objective: string;
  lastRoute: Room;
  lastApprovedAction: string;
  nextAction: string;
  lastLeftAt: string | null;
}

export interface ReturnPack {
  id: string;
  whereYouLeftOff: string;
  sessionState: string;
  lastApprovedAction: string;
  changedWork: string;
  waitingOnYou: string;
  recommendedNextAction: string;
  restartQuestion: string;
  createdAt: string;
}

export interface ConversationMessage {
  id: string;
  agent: AgentKey;
  role: "user" | "assistant";
  text: string;
  createdAt: string;
}

export interface LivingRoomMessage {
  id: string;
  threadId: string;
  role: "user" | "resident" | "system";
  agent: AgentKey | null;
  text: string;
  round: number;
  createdAt: string;
}

export interface LivingRoomContext {
  kind: "house" | "project" | "maker" | "critic" | "library" | "studio" | "workshop";
  label: string;
  summary: string;
  sourceId: string | null;
}

export interface LivingRoomThread {
  id: string;
  title: string;
  mode: LivingRoomMode;
  participants: AgentKey[];
  includeProject: boolean;
  workspaceProjectId: string;
  projectName: string;
  context: LivingRoomContext | null;
  messages: LivingRoomMessage[];
  createdAt: string;
  updatedAt: string;
}

export interface LivingRoomSnapshot {
  threads: LivingRoomThread[];
  archivedThreads: LivingRoomThread[];
  activeThreadId: string | null;
}

export type LivingRoomEvent =
  | {
      type: "started";
      requestId: string;
      threadId: string;
      mode: LivingRoomMode;
      participants: AgentKey[];
      userMessage: LivingRoomMessage;
    }
  | {
      type: "resident_started";
      requestId: string;
      threadId: string;
      agent: AgentKey;
      stage: string;
    }
  | {
      type: "delta";
      requestId: string;
      threadId: string;
      agent: AgentKey;
      text: string;
    }
  | {
      type: "resident_completed";
      requestId: string;
      threadId: string;
      message: LivingRoomMessage;
    }
  | {
      type: "completed" | "cancelled" | "failed";
      requestId: string;
      threadId: string;
      snapshot: LivingRoomSnapshot;
    };

export interface MakerProposal {
  id: string;
  sourceMessageId: string;
  workspaceProjectId: string | null;
  rootPath: string | null;
  projectName: string;
  contextKind: AgentContextKind | null;
  contextPath: string | null;
  instruction: string;
  rationale: string;
  expectedFiles: string[];
  risk: MakerProposalRisk;
  riskSummary: string;
  consultations: ResidentConsultation[];
  status: "draft" | "passed" | "completed" | "discarded";
  executionResult: MakerExecutionResult | null;
  createdAt: string;
  updatedAt: string;
  passedAt: string | null;
  resultAt: string | null;
}

export interface ResidentConsultation {
  id: string;
  from: "maker";
  to: "critic";
  phase: "preflight" | "postflight";
  reason:
    | "high-risk"
    | "unknown-risk"
    | "reported-concerns"
    | "evidence-partial"
    | "evidence-mismatch"
    | "user-requested";
  note: string;
  createdAt: string;
}

export interface MakerExecutionResult {
  changedFiles: string[];
  validation: string[];
  concerns: string[];
  decision: string;
  corroboration: ExecutionCorroboration | null;
}

export interface ExecutionCorroboration {
  status: "matched" | "partial" | "mismatch" | "unavailable";
  observedFiles: string[];
  matchedFiles: string[];
  missingReportedFiles: string[];
  additionalObservedFiles: string[];
  checkedAt: string;
}

export interface AgentProviderStatus {
  selection: AgentProviderSelection;
  active: AgentProviderSelection;
  available: boolean;
  state: "ready" | "local" | "degraded";
  name: string;
  models: Record<ReasoningAgent, string | null>;
  detail: string;
  lastError: string | null;
  lastUsedAt: string | null;
  residents?: Record<ReasoningAgent, ResidentProviderStatus>;
  diagnostics?: ProviderDiagnostics;
}

export interface ProviderRuntimeDiagnostics {
  label: string;
  adapterVersion: string | null;
  adapterFound: boolean;
  executableFound: boolean;
  authReadiness: "ready" | "unverified" | "unavailable";
  handshake: "connected" | "previously_connected" | "not_connected" | "failed";
  child: "running" | "stopped";
  activeTurns: number;
  knownSessions: number;
  lastHandshakeAt: string | null;
  lastSuccessAt: string | null;
  lastError: string | null;
}

export interface ProviderDiagnostics {
  checkedAt: string;
  claude: ProviderRuntimeDiagnostics;
  codex: ProviderRuntimeDiagnostics;
}

export interface ResidentProviderStatus {
  provider: "claude-code" | "codex" | "local";
  name: string;
  model: string | null;
  modelSource?: "reported" | "configured" | "unreported";
  available: boolean;
  state: "ready" | "local" | "degraded";
  detail: string;
  fallbackFrom: "codex" | null;
  lastError: string | null;
  lastUsedAt: string | null;
}

export interface AgentMessageUpdate {
  messages: ConversationMessage[];
  provider: AgentProviderStatus;
  cancelled: boolean;
  cancelReason: "stopped" | "interrupted" | null;
}

export interface MakerWorkActivity {
  id: string;
  kind:
    | "read"
    | "edit"
    | "delete"
    | "move"
    | "search"
    | "execute"
    | "think"
    | "fetch"
    | "switch_mode"
    | "other";
  title: string;
  status: "pending" | "in_progress" | "completed" | "failed";
  locations: string[];
  toolName?: string | null;
  input?: string | null;
  output?: string | null;
  diffs?: Array<{
    path: string;
    oldText: string | null;
    newText: string;
  }>;
  terminalIds?: string[];
  parentId?: string | null;
  subagent?: boolean;
  updatedAt: string;
}

export interface MakerWorkPlanEntry {
  content: string;
  priority: "high" | "medium" | "low";
  status: "pending" | "in_progress" | "completed";
}

export interface MakerSessionState {
  modelId?: string | null;
  modelName?: string | null;
  modelSource?: "reported" | "configured" | "unreported";
  modeId: string;
  modeName: string;
  availableModes: Array<{
    id: string;
    name: string;
    description: string | null;
  }>;
  ultracodeRequested: boolean;
  contextUsed: number | null;
  contextSize: number | null;
  inputTokens: number | null;
  outputTokens: number | null;
  cachedReadTokens: number | null;
  cachedWriteTokens: number | null;
  effortId?: string | null;
  effortName?: string | null;
  modePending?: boolean;
  effortPending?: boolean;
  availableEfforts?: Array<{
    id: string;
    name: string;
    description: string | null;
  }>;
}

export type MakerSessionControl =
  | { kind: "mode"; value?: string }
  | { kind: "effort"; value?: string };

export interface MakerPermissionOption {
  id: string;
  label: string;
  kind: "allow_once" | "allow_always" | "reject_once" | "reject_always";
}

export interface MakerPermissionRequest {
  id: string;
  toolCallId: string;
  title: string;
  kind: MakerWorkActivity["kind"];
  options: MakerPermissionOption[];
  createdAt: string;
}

export type WorkshopTurnHealthState =
  | "working"
  | "waiting_for_user"
  | "quiet_connected"
  | "reconnecting"
  | "stalled"
  | "interrupted"
  | "failed"
  | "completed";

export type WorkshopFailureClass =
  | "idle_timeout"
  | "absolute_timeout"
  | "adapter_exit"
  | "connection_lost"
  | "permission_expired"
  | "provider_error"
  | "interrupted"
  | "unknown";

export interface WorkshopTurnHealth {
  state: WorkshopTurnHealthState;
  turnStartedAt: string;
  lastProviderEventAt: string | null;
  lastToolEventAt: string | null;
  lastTerminalActivityAt: string | null;
  pendingPermissionSince: string | null;
  connection: "connecting" | "connected" | "disconnected";
  process: "starting" | "running" | "stopped";
  idleDeadlineAt: string | null;
  absoluteDeadlineAt: string | null;
  failure: {
    class: WorkshopFailureClass;
    message: string;
    fate: string;
    retrySafe: boolean;
  } | null;
}

export interface WorkshopTurnUsage {
  model: string | null;
  modelSource: "reported" | "configured" | "unreported";
  inputTokens: number | null;
  outputTokens: number | null;
  cachedReadTokens: number | null;
  cachedWriteTokens: number | null;
  contextUsed: number | null;
  contextSize: number | null;
  estimatedPromptCharacters: number;
  reportedAt: string;
}

export type WorkshopContextContributionKind =
  | "hearth_frame"
  | "current_direction"
  | "recent_conversation"
  | "project_evidence"
  | "terminal_view"
  | "execution_report"
  | "house_memory";

export interface WorkshopContextContribution {
  kind: WorkshopContextContributionKind;
  label: string;
  characters: number;
  truncated: boolean;
  detail: string;
}

export interface WorkshopContextManifest {
  continuingSession: boolean;
  promptCharacters: number;
  contributions: WorkshopContextContribution[];
  preservedUserTail: Array<{
    text: string;
    createdAt: string;
    sentAsRecentContext: boolean;
  }>;
  capturedAt: string;
}

export interface WorkshopTurn {
  id: string;
  workspaceProjectId: string;
  rootPath: string;
  prompt: string;
  activities: MakerWorkActivity[];
  plan: MakerWorkPlanEntry[];
  thoughts: string;
  sessionState: MakerSessionState | null;
  permissions: MakerPermissionRequest[];
  health: WorkshopTurnHealth | null;
  usage: WorkshopTurnUsage | null;
  contextManifest: WorkshopContextManifest | null;
  status: "running" | "completed" | "cancelled" | "failed";
  startedAt: string;
  updatedAt: string;
  completedAt: string | null;
}

export type AgentStreamEvent =
  | {
      type: "started";
      agent: ContextAgent;
      requestId: string;
      prompt?: string;
      startedAt?: string;
      contextManifest?: WorkshopContextManifest;
    }
  | {
      type: "delta";
      agent: ContextAgent;
      requestId: string;
      text: string;
    }
  | {
      type: "delta_reset";
      agent: "maker";
      requestId: string;
    }
  | {
      type: "completed" | "cancelled" | "failed";
      agent: ContextAgent;
      requestId: string;
      cancelReason?: "stopped" | "interrupted";
    }
  | {
      type: "activity";
      agent: "maker";
      requestId: string;
      activity: MakerWorkActivity;
    }
  | {
      type: "thought";
      agent: "maker";
      requestId: string;
      text: string;
    }
  | {
      type: "plan";
      agent: "maker";
      requestId: string;
      entries: MakerWorkPlanEntry[];
    }
  | {
      type: "session_state";
      agent: "maker";
      requestId: string;
      state: MakerSessionState;
    }
  | {
      type: "health";
      agent: "maker";
      requestId: string;
      health: WorkshopTurnHealth;
    }
  | {
      type: "usage";
      agent: "maker";
      requestId: string;
      usage: WorkshopTurnUsage;
    }
  | {
      type: "permission";
      agent: "maker";
      requestId: string;
      permission: MakerPermissionRequest;
    }
  | {
      type: "permission_resolved";
      agent: "maker";
      requestId: string;
      permissionId: string;
      optionId: string;
    };

export interface CaptureRecord {
  id: string;
  kind: "link" | "idea" | "note";
  text: string;
  domain: string | null;
  title: string | null;
  description: string | null;
  tags: string[];
  libraryCollection: string | null;
  pinned: boolean;
  archived: boolean;
  ideaState: "resting" | "pursuing" | "let-go" | null;
  ideaDecidedAt: string | null;
  promotionKind: "existing" | "created" | null;
  promotedAt: string | null;
  workspaceProjectId: string | null;
  projectName: string | null;
  createdAt: string;
  updatedAt: string;
  metadataFetchedAt: string | null;
}

export interface CaptureSaveResult {
  capture: CaptureRecord;
  duplicate: boolean;
}

export type LibraryShelf = "all" | "pinned" | "archive";
export type LibrarySort = "saved" | "updated" | "title" | "collection";

export interface LibraryCaptureQuery {
  query: string;
  shelf: LibraryShelf;
  collection: string | null;
  sort: LibrarySort;
  offset: number;
  limit: number;
}

export interface LibraryCapturePage {
  items: CaptureRecord[];
  total: number;
  offset: number;
  hasMore: boolean;
  activeCount: number;
  pinnedCount: number;
  archivedCount: number;
  unfiledCount: number;
  collections: Array<{ name: string; count: number }>;
}

export interface PersonalOsStackItem {
  id: string;
  url: string;
  title: string | null;
  domain: string;
  collection: string | null;
  tags: string[];
  capturedAt: string;
  alreadyInLibrary: boolean;
  needsCollection: boolean;
}

export interface PersonalOsStacksPreview {
  state: "missing" | "ready" | "unreadable";
  items: PersonalOsStackItem[];
  collections: Array<{
    name: string;
    count: number;
  }>;
  availableCount: number;
  newCount: number;
  organizationCount: number;
  message: string;
}

export interface PersonalOsStacksImportResult {
  imported: number;
  alreadyPresent: number;
  organized: number;
  preview: PersonalOsStacksPreview;
}

export interface CapturePatch {
  title?: string | null;
  description?: string | null;
  tags?: string[];
  libraryCollection?: string | null;
  pinned?: boolean;
  archived?: boolean;
  ideaState?: "resting" | "pursuing" | "let-go";
  workspaceProjectId?: string | null;
}

export type IdeaPromotionTarget =
  | {
      kind: "existing";
      projectId: string;
    }
  | {
      kind: "new";
      name: string;
    };

export interface IdeaPromotionResult {
  capture: CaptureRecord;
  project: WorkspaceProjectSummary;
  created: boolean;
  originFile: string | null;
}

export interface LibraryDiscoveryItem {
  id: string;
  kind: "repo" | "skill";
  name: string;
  description: string | null;
  url: string;
  stars: number;
  language: string | null;
  topics: string[];
  reason: string;
  emerging: boolean;
  pushedAt: string;
  feedback: LibraryDiscoveryFeedback;
}

export interface LibraryDiscoveryFeed {
  items: LibraryDiscoveryItem[];
  refreshedAt: string | null;
  state: "ready" | "empty" | "stale";
  message: string;
}

export interface LibraryDiscoveryTaste {
  keptLanguages: string[];
  dismissedLanguages: string[];
  keptTopics: string[];
  dismissedTopics: string[];
  savedTerms: string[];
}

export interface HouseMemoryRecord {
  id: string;
  kind: HouseMemoryKind;
  scope: HouseMemoryScope;
  subjectId: string | null;
  subjectLabel: string | null;
  text: string;
  reason: string | null;
  source: "user" | "observed";
  state: HouseMemoryState;
  createdAt: string;
  updatedAt: string;
}

export interface HouseMemorySnapshot {
  active: HouseMemoryRecord[];
  suggested: HouseMemoryRecord[];
  dismissed: HouseMemoryRecord[];
  dismissedCount: number;
}

export interface HouseMemoryInput {
  kind: HouseMemoryKind;
  scope: HouseMemoryScope;
  subjectId?: string | null;
  subjectLabel?: string | null;
  text: string;
}

export interface HouseMemoryPatch {
  kind?: HouseMemoryKind;
  scope?: HouseMemoryScope;
  subjectId?: string | null;
  subjectLabel?: string | null;
  text?: string;
  state?: HouseMemoryState;
}

export interface ActivityRecord {
  id: string;
  kind: string;
  summary: string;
  createdAt: string;
}

export type ArchiveKind =
  | "return-pack"
  | "library"
  | "idea"
  | "handoff"
  | "edit";

export type ArchiveAction =
  | "restore-library"
  | "restore-idea"
  | "undo-edit"
  | null;

export interface ArchiveDetail {
  label: string;
  value: string;
}

export interface ArchiveItem {
  id: string;
  kind: ArchiveKind;
  title: string;
  summary: string;
  status: string;
  projectId: string | null;
  projectName: string | null;
  path: string | null;
  details: ArchiveDetail[];
  action: ArchiveAction;
  returnPack: ReturnPack | null;
  removal: {
    removesFile: boolean;
    consequence: string;
  };
  createdAt: string;
}

export interface ArchiveSnapshot {
  items: ArchiveItem[];
  counts: Record<ArchiveKind, number>;
  generatedAt: string;
}

export interface ArchiveRemovalResult {
  id: string;
  kind: ArchiveKind;
  removedFile: boolean;
}

export interface CompanionAccessStatus {
  enabled: boolean;
  state: "off" | "starting" | "ready" | "failed";
  localUrl: string | null;
  pairingCode: string | null;
  pairingExpiresAt: string | null;
  detail: string;
  capabilities: string[];
}

export interface CompanionRemoteAccessStatus {
  provider: "tailscale";
  state:
    | "unavailable"
    | "signed-out"
    | "available"
    | "active"
    | "conflict"
    | "failed";
  installed: boolean;
  connected: boolean;
  ownedByHearth: boolean;
  remoteUrl: string | null;
  port: number;
  detail: string;
}

export interface CompanionSyncEvent {
  kind: "capture" | "conversation" | "decision";
  createdAt: string;
}

export interface AgentContext {
  id: string;
  agent: ContextAgent;
  workspaceProjectId: string;
  projectName: string;
  rootPath: string;
  kind: AgentContextKind;
  path: string | null;
  paths: string[];
  summary: string;
  evidence: string[];
  concerns: string[];
  createdAt: string;
}

export interface AgentContextUpdate {
  context: AgentContext;
  messages: ConversationMessage[];
}

export type WorkspaceSignal = "git" | "claude" | "codex" | "agents" | "hearth";

export interface WorkspaceProjectSummary {
  id: string;
  name: string;
  rootPath: string;
  signals: WorkspaceSignal[];
  branch: string | null;
  lastTouchedAt: string;
  selected: boolean;
}

export interface WorkspaceCatalog {
  projects: WorkspaceProjectSummary[];
  selectedProject: WorkspaceProjectSummary;
  scannedAt: string;
  homeRoot: string;
}

export interface WorkspaceProjectDetail {
  project: WorkspaceProjectSummary;
  description: string | null;
  packageManager: string | null;
  languages: string[];
  changeCount: number;
  stagedCount: number;
  untrackedCount: number;
  latestCommit: string | null;
}

export interface ProjectEntry {
  name: string;
  path: string;
  kind: "directory" | "file" | "symlink";
  size: number | null;
  modifiedAt: string;
}

export interface ProjectDirectory {
  projectId: string;
  path: string;
  entries: ProjectEntry[];
  truncated: boolean;
}

export interface ProjectFilePreview {
  projectId: string;
  path: string;
  name: string;
  language: string;
  text: string;
  size: number;
  lineCount: number;
  truncated: boolean;
  editable: boolean;
  editReason: string | null;
}

export interface ProjectSearchMatch {
  path: string;
  name: string;
  language: string;
  size: number;
  matchedBy: "path" | "content";
  line: number | null;
  snippet: string;
}

export interface ProjectSearchResult {
  projectId: string;
  query: string;
  matches: ProjectSearchMatch[];
  scannedFiles: number;
  truncated: boolean;
}

export interface ProjectEditLine {
  kind: "context" | "added" | "removed";
  text: string;
  oldLine: number | null;
  newLine: number | null;
}

export interface ProjectEditValidation {
  kind: "path" | "size" | "format" | "scope" | "concurrency";
  status: "passed" | "warning";
  message: string;
}

export interface ProjectEditProposal {
  request: string;
  summary: string;
  rationale: string;
}

export interface ProjectEditCritique {
  verdict: ProjectEditCritiqueVerdict;
  summary: string;
  concerns: string[];
  suggestedChecks: string[];
}

export interface ProjectEditDraft {
  id: string;
  projectId: string;
  projectName: string;
  path: string;
  origin: "user" | "maker";
  proposal: ProjectEditProposal | null;
  critique: ProjectEditCritique | null;
  additions: number;
  deletions: number;
  lines: ProjectEditLine[];
  validations: ProjectEditValidation[];
  createdAt: string;
  expiresAt: string;
}

export interface ProjectEditProposalResult {
  draft: ProjectEditDraft;
  proposedText: string;
  provider: AgentProviderStatus;
}

export interface ProjectEditCritiqueResult {
  draft: ProjectEditDraft;
  provider: AgentProviderStatus;
}

export interface ProjectEditRecord {
  id: string;
  projectId: string;
  projectName: string;
  path: string;
  additions: number;
  deletions: number;
  appliedAt: string;
  restoredAt: string | null;
}

export interface ProjectEditApplyResult {
  record: ProjectEditRecord;
  preview: ProjectFilePreview;
}

export interface ProjectChange {
  path: string;
  status: string;
  staged: boolean;
  unstaged: boolean;
  untracked: boolean;
}

export interface ProjectDiff {
  projectId: string;
  path: string | null;
  text: string;
  changes: ProjectChange[];
  truncated: boolean;
}

export interface TerminalCapabilities {
  shellName: string;
  shellPath: string;
  claudeAvailable: boolean;
  claudePath: string | null;
  claudeVersion: string | null;
  supportsNamedSessions: boolean;
  supportsSessionId: boolean;
  supportsResume: boolean;
}

export interface TerminalSession {
  id: string;
  projectId: string;
  cwd: string;
  pid: number | null;
  kind: TerminalKind;
  owner: TerminalOwner;
  lifecycle: TerminalLifecycle;
  startedAt: string;
  lastActivityAt: string;
  exitedAt: string | null;
  exitCode: number | null;
  claudeSessionId: string | null;
  claudeName: string | null;
  claudeResumable: boolean;
  cols: number;
  rows: number;
}

export interface TerminalSnapshot {
  session: TerminalSession | null;
  capabilities: TerminalCapabilities;
  scrollback: string;
  sequence: number;
  truncated: boolean;
  observation: TerminalObservation;
}

export interface TerminalObservation {
  state: TerminalObservationState;
  summary: string;
  requiresInput: boolean;
  updatedAt: string;
}

export type TerminalEvent =
  | {
      type: "output";
      sessionId: string;
      data: string;
      sequence: number;
    }
  | {
      type: "state";
      session: TerminalSession | null;
      sequence: number;
    }
  | {
      type: "observation";
      observation: TerminalObservation;
      sequence: number;
    }
  | {
      type: "proposal";
      proposal: MakerProposal;
      criticHandoff?: AgentContextUpdate;
      sequence: number;
    };

export interface BootstrapData {
  project: ProjectRecord;
  state: ProjectState;
  returnPack: ReturnPack;
  conversations: Record<AgentKey, ConversationMessage[]>;
  livingRoom: LivingRoomSnapshot;
  agentContexts: Record<AgentKey, AgentContext | null>;
  makerProposal: MakerProposal | null;
  notifications: NotificationPreferences;
  captures: CaptureRecord[];
  libraryDiscovery: LibraryDiscoveryFeed;
  houseMemory: HouseMemorySnapshot;
  activity: ActivityRecord[];
  workshop: {
    turns: WorkshopTurn[];
  };
  runtime: {
    coreStartedAt: string;
    databaseJournalMode: string;
    liveProcesses: number;
    provider: AgentProviderStatus;
  };
  terminal: TerminalSnapshot;
  workspace: {
    selectedProject: WorkspaceProjectSummary;
  };
}

export interface HearthApi {
  bootstrap(): Promise<BootstrapData>;
  setRoute(route: Room): Promise<ProjectState>;
  sendAgentMessage(
    agent: AgentKey,
    text: string,
    surface?: AgentSurface,
    libraryCaptureId?: string
  ): Promise<AgentMessageUpdate>;
  createLivingRoomDiscussion(
    mode: LivingRoomMode,
    participants: AgentKey[],
    includeProject: boolean,
    context?: LivingRoomContext
  ): Promise<LivingRoomSnapshot>;
  sendLivingRoomMessage(input: {
    threadId: string;
    text: string;
    mode: LivingRoomMode;
    participants: AgentKey[];
    includeProject: boolean;
  }): Promise<{ snapshot: LivingRoomSnapshot; cancelled: boolean }>;
  archiveLivingRoomDiscussion(threadId: string): Promise<LivingRoomSnapshot>;
  restoreLivingRoomDiscussion(threadId: string): Promise<LivingRoomSnapshot>;
  renameLivingRoomDiscussion(threadId: string, title: string): Promise<LivingRoomSnapshot>;
  cancelLivingRoomDiscussion(): Promise<{ cancelled: boolean }>;
  resolveMakerPermission(
    permissionId: string,
    optionId: string
  ): Promise<{ resolved: true }>;
  configureMakerSession(control: MakerSessionControl): Promise<MakerSessionState>;
  resetMakerSession(): Promise<{ reset: true }>;
  setAgentProvider(selection: AgentProviderSelection): Promise<AgentProviderStatus>;
  getNotificationStatus(): Promise<DesktopNotificationStatus>;
  setNotificationPreferences(
    preferences: NotificationPreferences
  ): Promise<DesktopNotificationStatus>;
  cancelAgentMessage(agent: ReasoningAgent): Promise<{ cancelled: boolean }>;
  createMakerProposal(messageId: string): Promise<{
    proposal: MakerProposal;
    provider: AgentProviderStatus;
    criticHandoff: AgentContextUpdate | null;
  }>;
  updateMakerProposal(proposalId: string, instruction: string): Promise<MakerProposal>;
  discardMakerProposal(proposalId: string): Promise<{ discarded: true }>;
  completeMakerProposal(proposalId: string): Promise<MakerProposal>;
  closeMakerProposal(proposalId: string): Promise<{ closed: true }>;
  handoffExecutionResultToCritic(proposalId: string): Promise<
    AgentContextUpdate & { proposal: MakerProposal }
  >;
  setAgentContext(
    agent: ContextAgent,
    projectId: string,
    kind: AgentContextKind,
    path?: string,
    paths?: string[]
  ): Promise<AgentContextUpdate>;
  saveCapture(
    text: string,
    kind?: CaptureRecord["kind"]
  ): Promise<CaptureSaveResult>;
  updateCapture(captureId: string, patch: CapturePatch): Promise<CaptureRecord>;
  searchCaptures(
    query: string,
    kind?: CaptureRecord["kind"],
    limit?: number
  ): Promise<CaptureRecord[]>;
  listLibraryCaptures(query: LibraryCaptureQuery): Promise<LibraryCapturePage>;
  inspectPersonalOsStacks(): Promise<PersonalOsStacksPreview>;
  importPersonalOsStacks(): Promise<PersonalOsStacksImportResult>;
  getArchive(): Promise<ArchiveSnapshot>;
  removeArchiveItem(
    archiveId: string,
    kind: ArchiveKind
  ): Promise<ArchiveRemovalResult>;
  getIdeaConversation(captureId: string): Promise<ConversationMessage[]>;
  sendIdeaMessage(
    captureId: string,
    text: string
  ): Promise<AgentMessageUpdate>;
  promoteIdea(
    captureId: string,
    target: IdeaPromotionTarget
  ): Promise<IdeaPromotionResult>;
  enrichCapture(captureId: string): Promise<CaptureRecord>;
  refreshLibraryDiscovery(force?: boolean): Promise<LibraryDiscoveryFeed>;
  setLibraryDiscoveryFeedback(
    discoveryId: string,
    feedback: LibraryDiscoveryFeedback
  ): Promise<LibraryDiscoveryFeed>;
  saveHouseMemory(input: HouseMemoryInput): Promise<HouseMemorySnapshot>;
  updateHouseMemory(
    memoryId: string,
    patch: HouseMemoryPatch
  ): Promise<HouseMemorySnapshot>;
  forgetHouseMemory(memoryId: string): Promise<HouseMemorySnapshot>;
  updateObjective(objective: string): Promise<ProjectState>;
  leaveProject(note?: string): Promise<ReturnPack>;
  createBackup(reason: string): Promise<{ path: string; createdAt: string }>;
  listWorkspaceProjects(refresh?: boolean): Promise<WorkspaceCatalog>;
  selectWorkspaceProject(projectId: string): Promise<WorkspaceProjectSummary>;
  getWorkspaceProject(projectId: string): Promise<WorkspaceProjectDetail>;
  listProjectDirectory(projectId: string, path: string): Promise<ProjectDirectory>;
  readProjectFile(projectId: string, path: string): Promise<ProjectFilePreview>;
  searchProjectFiles(projectId: string, query: string): Promise<ProjectSearchResult>;
  prepareProjectEdit(
    projectId: string,
    path: string,
    text: string
  ): Promise<ProjectEditDraft>;
  proposeProjectEdit(
    projectId: string,
    path: string,
    instruction: string
  ): Promise<ProjectEditProposalResult>;
  critiqueProjectEdit(editId: string): Promise<ProjectEditCritiqueResult>;
  applyProjectEdit(editId: string): Promise<ProjectEditApplyResult>;
  listProjectEdits(projectId: string): Promise<ProjectEditRecord[]>;
  restoreProjectEdit(editId: string): Promise<ProjectEditApplyResult>;
  readProjectDiff(projectId: string, path?: string): Promise<ProjectDiff>;
  attachTerminal(): Promise<TerminalSnapshot>;
  detachTerminal(): Promise<{ detached: true }>;
  startTerminal(kind: TerminalKind, owner: TerminalOwner): Promise<TerminalSnapshot>;
  resumeTerminal(owner: TerminalOwner): Promise<TerminalSnapshot>;
  terminalInput(sessionId: string, data: string): Promise<{ accepted: true }>;
  terminalInstruction(
    sessionId: string,
    proposalId: string,
    text: string
  ): Promise<{ accepted: true }>;
  terminalResize(
    sessionId: string,
    cols: number,
    rows: number
  ): Promise<TerminalSession>;
  stopTerminal(sessionId: string): Promise<TerminalSession>;
  setTerminalOwner(sessionId: string, owner: TerminalOwner): Promise<TerminalSession>;
  onTerminalEvent(listener: (event: TerminalEvent) => void): () => void;
  onAgentStreamEvent(listener: (event: AgentStreamEvent) => void): () => void;
  onLivingRoomEvent(listener: (event: LivingRoomEvent) => void): () => void;
  openExternal(url: string): Promise<{ opened: true }>;
  readClipboard(): Promise<string>;
  writeClipboard(text: string): Promise<{ written: true }>;
  getCompanionAccess(): Promise<CompanionAccessStatus>;
  setCompanionAccess(enabled: boolean): Promise<CompanionAccessStatus>;
  rotateCompanionPairing(): Promise<CompanionAccessStatus>;
  getCompanionRemoteAccess(): Promise<CompanionRemoteAccessStatus>;
  setCompanionRemoteAccess(
    enabled: boolean
  ): Promise<CompanionRemoteAccessStatus>;
  onCompanionSync(listener: (event: CompanionSyncEvent) => void): () => void;
  onNotificationNavigation(listener: (room: Room) => void): () => void;
  platform: "win32";
}

export interface CoreResponse {
  id: string;
  ok: boolean;
  result?: unknown;
  error?: {
    message: string;
    code: string;
  };
}

export interface CoreReadyMessage {
  type: "ready";
  journalMode: string;
}
