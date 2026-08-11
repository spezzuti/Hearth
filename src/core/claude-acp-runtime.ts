import { randomUUID } from "node:crypto";
import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { Readable, Writable } from "node:stream";
import {
  client,
  methods,
  ndJsonStream,
  PROTOCOL_VERSION,
  type ClientConnection,
  type RequestPermissionRequest,
  type SessionConfigOption,
  type SessionModeState,
  type SessionNotification,
  type ToolCall,
  type ToolCallUpdate
} from "@agentclientprotocol/sdk";
import packageJson from "../../package.json";
import type {
  MakerPermissionRequest,
  MakerSessionControl,
  MakerSessionState,
  WorkshopFailureClass,
  WorkshopTurnHealth,
  WorkshopTurnUsage,
  MakerWorkPlanEntry,
  MakerWorkActivity
} from "../shared/contracts";

const TURN_IDLE_TIMEOUT_MS = 10 * 60_000;
const TURN_ABSOLUTE_TIMEOUT_MS = 2 * 60 * 60_000;
const TURN_QUIET_AFTER_MS = 30_000;
const PERMISSION_TIMEOUT_MS = 10 * 60_000;
const MAX_REPLY_CHARACTERS = 24_000;
const MAX_WORK_DETAIL_CHARACTERS = 20_000;
const MAX_COMPACT_INPUT_CHARACTERS = 1_200;
const MAX_DIFF_SIDE_CHARACTERS = 32_000;

export interface ClaudeAcpRuntimeTiming {
  idleTimeoutMs?: number;
  absoluteTimeoutMs?: number;
  quietAfterMs?: number;
  permissionTimeoutMs?: number;
}

function boundedTestTiming(name: string, fallback: number): number {
  if (process.env.HEARTH_RUNTIME_TEST_TIMING !== "1") return fallback;
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value >= 250 ? Math.floor(value) : fallback;
}

export type ManagedMakerRuntimeEvent =
  | { type: "delta"; text: string }
  | { type: "reply_boundary" }
  | { type: "activity"; activity: MakerWorkActivity }
  | { type: "thought"; text: string }
  | { type: "plan"; entries: MakerWorkPlanEntry[] }
  | { type: "session_state"; state: MakerSessionState }
  | { type: "health"; health: WorkshopTurnHealth }
  | { type: "usage"; usage: WorkshopTurnUsage }
  | { type: "permission"; permission: MakerPermissionRequest }
  | { type: "permission_resolved"; permissionId: string; optionId: string };

interface ActiveTurn {
  requestId: string;
  reply: string;
  replySegments: string[];
  sawToolCall: boolean;
  mutationObserved: boolean;
  activeToolIds: Set<string>;
  onEvent: (event: ManagedMakerRuntimeEvent) => void;
  finished: Promise<void>;
  resolveFinished: () => void;
  health: WorkshopTurnHealth;
  idleTimer: ReturnType<typeof setTimeout> | null;
  quietTimer: ReturnType<typeof setTimeout> | null;
  absoluteTimer: ReturnType<typeof setTimeout> | null;
  rejectDeadline: ((error: Error) => void) | null;
}

export class ClaudeAcpTurnDeadlineError extends Error {
  constructor(readonly failureClass: Extract<WorkshopFailureClass, "idle_timeout" | "absolute_timeout">) {
    super(failureClass === "idle_timeout"
      ? "Maker stopped receiving activity from Claude Code."
      : "Maker reached the two-hour safety ceiling for one turn.");
    this.name = "ClaudeAcpTurnDeadlineError";
  }
}

function isoAfter(milliseconds: number): string {
  return new Date(Date.now() + milliseconds).toISOString();
}

function installedAdapterVersion(adapterPath: string | null): string | null {
  if (!adapterPath) return null;
  try {
    const manifest = JSON.parse(readFileSync(path.resolve(adapterPath, "..", "..", "package.json"), "utf8")) as { version?: unknown };
    return typeof manifest.version === "string" ? manifest.version : null;
  } catch {
    return null;
  }
}

interface PendingPermission {
  sessionId: string;
  requestId: string;
  timeout: ReturnType<typeof setTimeout>;
  options: RequestPermissionRequest["options"];
  resolve: (response: {
    outcome:
      | { outcome: "selected"; optionId: string }
      | { outcome: "cancelled" };
  }) => void;
}

export class ClaudeAcpCancelledError extends Error {
  constructor(readonly reason: "stopped" | "interrupted" = "stopped") {
    super(reason === "interrupted" ? "Maker was interrupted by a new message." : "Maker stopped working.");
    this.name = "ClaudeAcpCancelledError";
  }
}

function adapterCandidates(): string[] {
  const relative = path.join(
    "node_modules",
    "@agentclientprotocol",
    "claude-agent-acp",
    "dist",
    "index.js"
  );
  const resourcesPath = (process as NodeJS.Process & { resourcesPath?: string })
    .resourcesPath;
  return [
    resourcesPath ? path.join(resourcesPath, "app.asar", relative) : "",
    path.resolve(process.cwd(), relative),
    typeof __dirname === "string" ? path.resolve(__dirname, "..", "..", relative) : ""
  ].filter(Boolean);
}

export function findClaudeAcpAdapter(): string | null {
  return adapterCandidates().find((candidate) => existsSync(candidate)) ?? null;
}

function now(): string {
  return new Date().toISOString();
}

function sealReplySegment(turn: ActiveTurn): void {
  const segment = turn.reply.trim();
  if (segment) turn.replySegments.push(segment);
  turn.reply = "";
}

function boundedDetail(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  let text: string;
  if (typeof value === "string") {
    text = value;
  } else {
    try {
      text = JSON.stringify(value, null, 2);
    } catch {
      text = String(value);
    }
  }
  const clean = text.trim();
  if (!clean) return null;
  return clean.length > MAX_WORK_DETAIL_CHARACTERS
    ? `${clean.slice(0, MAX_WORK_DETAIL_CHARACTERS)}\n…output trimmed by Hearth`
    : clean;
}

function metadata(update: ToolCall | ToolCallUpdate): {
  toolName: string | null;
  title: string | null;
  parentId: string | null;
  subagent: boolean;
} {
  const root = update._meta;
  const claude =
    root && typeof root.claudeCode === "object" && root.claudeCode !== null
      ? (root.claudeCode as Record<string, unknown>)
      : null;
  return {
    toolName:
      typeof update.name === "string"
        ? update.name
        : typeof claude?.toolName === "string"
          ? claude.toolName
          : null,
    title: typeof claude?.title === "string" ? claude.title : null,
    parentId:
      typeof claude?.parentToolUseId === "string" ? claude.parentToolUseId : null,
    subagent: claude?.subagent === true
  };
}

function compactText(value: unknown, limit = MAX_COMPACT_INPUT_CHARACTERS): string | null {
  if (typeof value !== "string") return null;
  const clean = value.trim();
  if (!clean) return null;
  return clean.length > limit ? `${clean.slice(0, limit)}\n…trimmed by Hearth` : clean;
}

function boundedDiffSide(value: string | null): string | null {
  if (value === null || value.length <= MAX_DIFF_SIDE_CHARACTERS) return value;
  const half = Math.floor(MAX_DIFF_SIDE_CHARACTERS / 2);
  return `${value.slice(0, half)}\n…middle of large diff omitted by Hearth…\n${value.slice(-half)}`;
}

function inputDetail(value: unknown, toolName: string | null): string | null {
  if (!value || typeof value !== "object") return compactText(value);
  const input = value as Record<string, unknown>;
  const normalizedTool = toolName?.toLocaleLowerCase() ?? "";
  const command = compactText(input.command);
  if (command) return command;

  const pathValue = compactText(input.file_path ?? input.path ?? input.filename, 500);
  if (/edit|write|read|notebook/.test(normalizedTool)) return pathValue;

  const pattern = compactText(input.pattern ?? input.query ?? input.glob, 500);
  if (pattern) return pathValue ? `${pattern} · ${pathValue}` : pattern;

  const description = compactText(input.description, 500);
  if (description) return description;
  const prompt = compactText(input.prompt, 900);
  if (prompt) return prompt;

  const concise = Object.entries(input)
    .filter(([, item]) => ["string", "number", "boolean"].includes(typeof item))
    .slice(0, 5)
    .map(([key, item]) => `${key}: ${String(item)}`)
    .join("\n");
  return compactText(concise);
}

function workContent(update: ToolCall | ToolCallUpdate): {
  output: string | null;
  diffs: NonNullable<MakerWorkActivity["diffs"]>;
  terminalIds: string[];
} {
  const text: string[] = [];
  const diffs: NonNullable<MakerWorkActivity["diffs"]> = [];
  const terminalIds: string[] = [];
  for (const item of update.content ?? []) {
    if (item.type === "diff") {
      diffs.push({
        path: item.path,
        oldText: boundedDiffSide(item.oldText ?? null),
        newText: boundedDiffSide(item.newText) ?? ""
      });
    } else if (item.type === "terminal") {
      terminalIds.push(item.terminalId);
    } else if (item.content.type === "text") {
      text.push(item.content.text);
    } else if (item.content.type === "resource_link") {
      text.push(`${item.content.title ?? item.content.name}: ${item.content.uri}`);
    }
  }
  const raw = text.length ? null : boundedDetail(update.rawOutput);
  if (raw) text.push(raw);
  const uniqueText = text.filter(
    (entry, index) => text.findIndex((candidate) => candidate.trim() === entry.trim()) === index
  );
  return {
    output: boundedDetail(uniqueText.join("\n\n")),
    diffs,
    terminalIds
  };
}

function locations(update: ToolCall | ToolCallUpdate): string[] {
  return [...new Set((update.locations ?? [])
    .map((location) => location.path)
    .filter((value): value is string => typeof value === "string"))]
    .slice(0, 12);
}

export function normalizeClaudeToolActivity(
  update: ToolCall | ToolCallUpdate,
  previous?: MakerWorkActivity
): MakerWorkActivity {
  const meta = metadata(update);
  const content = workContent(update);
  const nextLocations = locations(update);
  const nextKind = update.kind ?? previous?.kind ?? "other";
  const nextInput = inputDetail(update.rawInput, meta.toolName);
  const inputDuplicatesLocation = Boolean(
    nextInput && nextKind !== "execute" && nextLocations.some(
      (location) => location.toLocaleLowerCase() === nextInput.toLocaleLowerCase()
    )
  );
  const outputIsEditReceipt = Boolean(
    content.diffs.length && content.output &&
      /(?:updated|created|written|replaced).*success|file state is current/i.test(content.output)
  );
  return {
    id: update.toolCallId,
    kind: nextKind,
    title: meta.title ?? update.title ?? previous?.title ?? "Working",
    status: update.status ?? previous?.status ?? "pending",
    locations: nextLocations.length ? nextLocations : previous?.locations ?? [],
    toolName: meta.toolName ?? previous?.toolName ?? null,
    input: inputDuplicatesLocation ? null : nextInput ?? previous?.input ?? null,
    output: outputIsEditReceipt ? null : content.output ?? previous?.output ?? null,
    diffs: content.diffs.length ? content.diffs : previous?.diffs ?? [],
    terminalIds: content.terminalIds.length
      ? content.terminalIds
      : previous?.terminalIds ?? [],
    parentId: meta.parentId ?? previous?.parentId ?? null,
    subagent: meta.subagent || previous?.subagent || false,
    updatedAt: now()
  };
}

function selectValues(option: SessionConfigOption): Array<{
  id: string;
  name: string;
  description: string | null;
}> {
  if (option.type !== "select") return [];
  return option.options.flatMap((entry) =>
    "options" in entry
      ? entry.options.map((item) => ({
          id: item.value,
          name: item.name,
          description: item.description ?? null
        }))
      : [{ id: entry.value, name: entry.name, description: entry.description ?? null }]
  );
}

function effortOption(options?: SessionConfigOption[] | null): SessionConfigOption | null {
  return options?.find(
    (option) => option.type === "select" &&
      (option.id.toLocaleLowerCase() === "effort" || option.category === "thought_level")
  ) ?? null;
}

function modelOption(options?: SessionConfigOption[] | null): SessionConfigOption | null {
  return options?.find(
    (option) => option.type === "select" &&
      (option.id.toLocaleLowerCase() === "model" || option.category === "model")
  ) ?? null;
}

function readableClaudeModel(value: string): string {
  return value
    .replace(/^claude-/i, "Claude ")
    .replaceAll("-", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

const MAKER_MODE_ORDER = ["default", "auto", "plan"] as const;
const MAKER_MODE_NAMES: Record<(typeof MAKER_MODE_ORDER)[number], string> = {
  default: "Manual",
  auto: "Auto",
  plan: "Planning"
};

type MakerModeOption = MakerSessionState["availableModes"][number];
type MakerEffortOption = NonNullable<MakerSessionState["availableEfforts"]>[number];

function normalizedMakerModeId(value: string): string {
  const normalized = value.trim().toLocaleLowerCase();
  if (normalized === "manual") return "default";
  if (normalized === "planning" || normalized === "plan mode") return "plan";
  return normalized;
}

export function makerModeOptions(modes?: SessionModeState | null): MakerModeOption[] {
  const advertised = modes?.availableModes ?? [];
  return MAKER_MODE_ORDER.flatMap((id) => {
    const mode = advertised.find((candidate) => candidate.id === id);
    return mode
      ? [{ id, name: MAKER_MODE_NAMES[id], description: mode.description ?? null }]
      : [];
  });
}

export function nextMakerMode(
  modes: MakerModeOption[],
  currentModeId: string,
  requestedValue?: string
): MakerModeOption | null {
  if (!modes.length) return null;
  if (requestedValue) {
    const requested = normalizedMakerModeId(requestedValue);
    return modes.find((mode) => mode.id.toLocaleLowerCase() === requested) ?? null;
  }
  const currentIndex = modes.findIndex((mode) => mode.id === currentModeId);
  return currentIndex < 0 ? modes[0]! : modes[(currentIndex + 1) % modes.length]!;
}

export function nextMakerEffort(
  efforts: MakerEffortOption[],
  currentEffortId: string | null | undefined,
  requestedValue?: string
): MakerEffortOption | null {
  if (!efforts.length) return null;
  if (requestedValue) {
    const requested = requestedValue.trim().toLocaleLowerCase();
    return efforts.find((item) =>
      item.id.toLocaleLowerCase() === requested || item.name.toLocaleLowerCase() === requested
    ) ?? null;
  }
  const currentIndex = efforts.findIndex((item) => item.id === currentEffortId);
  return currentIndex < 0 ? efforts[0]! : efforts[(currentIndex + 1) % efforts.length]!;
}

interface ClaudeTranscriptUsage {
  model: string | null;
  inputTokens: number;
  outputTokens: number;
  cachedReadTokens: number;
  cachedWriteTokens: number;
  contextUsed: number;
}

export function latestClaudeTranscriptUsage(text: string): ClaudeTranscriptUsage | null {
  const lines = text.trimEnd().split(/\r?\n/);
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    try {
      const row = JSON.parse(lines[index]!) as {
        type?: string;
        isSidechain?: boolean;
        message?: {
          model?: string;
          usage?: {
            input_tokens?: number;
            output_tokens?: number;
            cache_read_input_tokens?: number;
            cache_creation_input_tokens?: number;
          };
        };
      };
      const usage = row.message?.usage;
      if (row.type !== "assistant" || row.isSidechain || row.message?.model === "<synthetic>" || !usage) {
        continue;
      }
      const inputTokens = usage.input_tokens ?? 0;
      const outputTokens = usage.output_tokens ?? 0;
      const cachedReadTokens = usage.cache_read_input_tokens ?? 0;
      const cachedWriteTokens = usage.cache_creation_input_tokens ?? 0;
      const contextUsed = inputTokens + outputTokens + cachedReadTokens + cachedWriteTokens;
      if (contextUsed <= 0) continue;
      return {
        model: row.message?.model ? readableClaudeModel(row.message.model) : null,
        inputTokens,
        outputTokens,
        cachedReadTokens,
        cachedWriteTokens,
        contextUsed
      };
    } catch {
      // Ignore partial or non-JSON transcript lines and keep looking backward.
    }
  }
  return null;
}

function claudeTranscriptUsage(cwd: string, sessionId: string): ClaudeTranscriptUsage | null {
  const configRoot = process.env.CLAUDE_CONFIG_DIR?.trim() || path.join(os.homedir(), ".claude");
  const projectDirectory = cwd.replace(/[^a-zA-Z0-9-]/g, "-");
  const transcriptPath = path.join(configRoot, "projects", projectDirectory, `${sessionId}.jsonl`);
  if (!existsSync(transcriptPath)) return null;
  try {
    const text = readFileSync(transcriptPath, "utf8").slice(-2_000_000);
    return latestClaudeTranscriptUsage(text);
  } catch {
    return null;
  }
}

function sessionState(
  modes?: SessionModeState | null,
  configOptions?: SessionConfigOption[] | null
): MakerSessionState {
  const availableModes = makerModeOptions(modes);
  const modeId = modes?.currentModeId ?? "default";
  const effort = effortOption(configOptions);
  const model = modelOption(configOptions);
  const availableModels = model ? selectValues(model) : [];
  const modelId = model?.type === "select" ? model.currentValue : null;
  const modelName = availableModels.find((item) => item.id === modelId)?.name ?? modelId;
  const availableEfforts = effort ? selectValues(effort) : [];
  const effortId = effort?.type === "select" ? effort.currentValue : null;
  return {
    modelId,
    modelName: modelName ? readableClaudeModel(modelName) : "Opus",
    modelSource: modelName ? "reported" : "configured",
    modeId,
    modeName: availableModes.find((mode) => mode.id === modeId)?.name ??
      (modeId in MAKER_MODE_NAMES
        ? MAKER_MODE_NAMES[modeId as keyof typeof MAKER_MODE_NAMES]
        : "Manual"),
    availableModes,
    ultracodeRequested: false,
    contextUsed: null,
    contextSize: null,
    inputTokens: null,
    outputTokens: null,
    cachedReadTokens: null,
    cachedWriteTokens: null,
    effortId,
    effortName: availableEfforts.find((item) => item.id === effortId)?.name ?? effortId,
    availableEfforts
  };
}

export type MakerRequestedMode = "auto" | "default" | "acceptEdits" | "plan" | "dontAsk";

export function requestedMakerMode(text: string): MakerRequestedMode | null {
  const normalized = text.trim().toLocaleLowerCase();
  const slash = normalized.match(/^\/(auto|plan|manual|accept-edits|dont-ask)\b/);
  const candidate =
    slash?.[1] ??
    normalized.match(
      /\b(?:switch|change|go|move|set)(?:\s+(?:me|maker|us))?(?:\s+back)?(?:\s+(?:to|into|over to))?\s+(auto|plan|planning|manual)(?:\s+mode)?\b/
    )?.[1] ??
    normalized.match(/\b(?:use|enter)\s+(auto|plan|planning|manual)\s+mode\b/)?.[1];
  if (candidate === "plan" || candidate === "planning") return "plan";
  if (candidate === "auto") return "auto";
  if (candidate === "manual") return "default";
  if (candidate === "accept-edits") return "acceptEdits";
  if (candidate === "dont-ask") return "dontAsk";
  return null;
}

export class ClaudeAcpRuntime {
  readonly adapterPath = findClaudeAcpAdapter();
  private readonly claudeExecutable: string | null;
  private child: ChildProcess | null = null;
  private connection: ClientConnection | null = null;
  private connecting: Promise<ClientConnection> | null = null;
  private sessions = new Map<string, string>();
  private turns = new Map<string, ActiveTurn>();
  private activities = new Map<string, MakerWorkActivity>();
  private sessionStates = new Map<string, MakerSessionState>();
  private sessionConfigOptions = new Map<string, SessionConfigOption[]>();
  private pendingModes = new Map<string, string>();
  private pendingEfforts = new Map<string, string>();
  private permissions = new Map<string, PendingPermission>();
  private cancelled = new Set<string>();
  private interrupted = new Set<string>();
  private stderr = "";
  private lastHandshakeAt: string | null = null;
  private lastSuccessAt: string | null = null;
  private lastError: string | null = null;
  private lastDisconnectClass: Extract<WorkshopFailureClass, "adapter_exit" | "connection_lost"> | null = null;
  private readonly timing: Required<ClaudeAcpRuntimeTiming>;

  constructor(claudeExecutable: string | null, timing: ClaudeAcpRuntimeTiming = {}) {
    this.claudeExecutable = claudeExecutable;
    this.timing = {
      idleTimeoutMs: timing.idleTimeoutMs ?? boundedTestTiming("HEARTH_TEST_TURN_IDLE_MS", TURN_IDLE_TIMEOUT_MS),
      absoluteTimeoutMs: timing.absoluteTimeoutMs ?? boundedTestTiming("HEARTH_TEST_TURN_ABSOLUTE_MS", TURN_ABSOLUTE_TIMEOUT_MS),
      quietAfterMs: timing.quietAfterMs ?? boundedTestTiming("HEARTH_TEST_TURN_QUIET_MS", TURN_QUIET_AFTER_MS),
      permissionTimeoutMs: timing.permissionTimeoutMs ?? boundedTestTiming("HEARTH_TEST_PERMISSION_MS", PERMISSION_TIMEOUT_MS)
    };
  }

  get available(): boolean {
    return Boolean(this.adapterPath && this.claudeExecutable);
  }

  resetSession(cwd: string): void {
    const sessionId = this.sessions.get(cwd);
    if (!sessionId) return;
    if (this.turns.has(sessionId)) throw new Error("Stop Maker before starting a fresh session.");
    this.sessions.delete(cwd);
    this.sessionStates.delete(sessionId);
    this.sessionConfigOptions.delete(sessionId);
    this.pendingModes.delete(sessionId);
    this.pendingEfforts.delete(sessionId);
  }

  diagnostics(): import("../shared/contracts").ProviderRuntimeDiagnostics {
    return {
      label: "Claude Code",
      adapterVersion: installedAdapterVersion(this.adapterPath),
      adapterFound: Boolean(this.adapterPath),
      executableFound: Boolean(this.claudeExecutable),
      authReadiness: !this.claudeExecutable ? "unavailable" : this.lastSuccessAt ? "ready" : "unverified",
      handshake: this.connection ? "connected" : this.lastHandshakeAt ? "previously_connected" : this.lastError ? "failed" : "not_connected",
      child: this.child?.exitCode == null && this.child ? "running" : "stopped",
      activeTurns: this.turns.size,
      knownSessions: this.sessions.size,
      lastHandshakeAt: this.lastHandshakeAt,
      lastSuccessAt: this.lastSuccessAt,
      lastError: this.lastError?.slice(0, 320) ?? null
    };
  }

  async configure(
    cwd: string,
    control: MakerSessionControl,
    continuity?: {
      resumeSessionId?: string | null;
      onSessionReady?: (sessionId: string) => void;
    }
  ): Promise<MakerSessionState> {
    const { connection, sessionId } = await this.ensureSession(cwd, continuity);
    if (this.turns.has(sessionId)) throw new Error("Wait for Maker to finish before changing this setting.");
    let state = this.sessionStates.get(sessionId) ?? sessionState();

    if (control.kind === "mode") {
      if (!state.availableModes.length) throw new Error("Claude did not report any selectable modes.");
      const selected = nextMakerMode(state.availableModes, state.modeId, control.value);
      if (!selected) throw new Error(`Claude does not offer a ${control.value} mode in this session.`);
      await connection.agent.request(methods.agent.session.setMode, {
        sessionId,
        modeId: selected.id
      });
      this.pendingModes.delete(sessionId);
      state = { ...state, modeId: selected.id, modeName: selected.name, modePending: false };
    } else {
      const options = this.sessionConfigOptions.get(sessionId) ?? [];
      const effort = effortOption(options);
      if (!effort || effort.type !== "select") {
        throw new Error("This Claude session does not expose an effort control.");
      }
      const values = selectValues(effort);
      const selected = nextMakerEffort(values, state.effortId ?? effort.currentValue, control.value);
      if (!selected) throw new Error(`Claude does not offer a ${control.value} effort level.`);
      const response = await connection.agent.request(
        methods.agent.session.setConfigOption,
        { sessionId, configId: effort.id, value: selected.id }
      );
      this.sessionConfigOptions.set(sessionId, response.configOptions);
      this.pendingEfforts.delete(sessionId);
      const confirmed = sessionState(null, response.configOptions);
      state = {
        ...state,
        effortId: confirmed.effortId ?? selected.id,
        effortName: confirmed.effortName ?? selected.name,
        availableEfforts: confirmed.availableEfforts,
        effortPending: false
      };
    }
    this.sessionStates.set(sessionId, state);
    return state;
  }

  async reason(
    cwd: string,
    requestId: string,
    prompt: string,
    onEvent: (event: ManagedMakerRuntimeEvent) => void,
    continuity?: {
      resumeSessionId?: string | null;
      onSessionReady?: (sessionId: string) => void;
      requestedMode?: MakerRequestedMode | null;
      ultracodeRequested?: boolean;
      interruptActive?: boolean;
    }
  ): Promise<string> {
    const turnStartedAt = now();
    const connectingHealth: WorkshopTurnHealth = {
      state: "reconnecting",
      turnStartedAt,
      lastProviderEventAt: null,
      lastToolEventAt: null,
      lastTerminalActivityAt: null,
      pendingPermissionSince: null,
      connection: "connecting",
      process: "starting",
      idleDeadlineAt: null,
      absoluteDeadlineAt: isoAfter(this.timing.absoluteTimeoutMs),
      failure: null
    };
    onEvent({ type: "health", health: connectingHealth });
    let ensured;
    try {
      ensured = await this.ensureSession(cwd, continuity);
    } catch (error) {
      const health: WorkshopTurnHealth = {
        ...connectingHealth,
        state: "failed",
        connection: "disconnected",
        process: "stopped",
        absoluteDeadlineAt: null,
        failure: {
          class: "connection_lost",
          message: error instanceof Error ? error.message.slice(0, 320) : "Claude Code could not open its managed connection.",
          fate: "No turn started and nothing was replayed.",
          retrySafe: true
        }
      };
      onEvent({ type: "health", health });
      throw error;
    }
    const { connection, sessionId, resumedPriorSession } = ensured;
    let modeSwitch: { title: string; status: "completed" | "failed" } | null = null;
    let state = this.sessionStates.get(sessionId) ?? sessionState();
    const usageBaseline = {
      inputTokens: state.inputTokens,
      outputTokens: state.outputTokens,
      cachedReadTokens: state.cachedReadTokens,
      cachedWriteTokens: state.cachedWriteTokens
    };
    const requestedMode = continuity?.requestedMode ?? this.pendingModes.get(sessionId) ?? null;
    if (requestedMode) {
      const requested = requestedMode;
      if (state.availableModes.some((mode) => mode.id === requested)) {
        state = {
          ...state,
          modeId: requested,
          modeName: state.availableModes.find((mode) => mode.id === requested)?.name ?? requested,
          modePending: true
        };
        modeSwitch = {
          title: `Switched to ${state.modeName}`,
          status: "completed"
        };
      } else {
        const requestedName = requested === "default"
          ? "Manual"
          : requested === "plan"
            ? "Planning"
            : requested === "auto"
              ? "Auto"
              : requested;
        modeSwitch = {
          title: `${requestedName} isn't available for this model`,
          status: "failed"
        };
      }
    }
    if (continuity?.ultracodeRequested) {
      state = { ...state, ultracodeRequested: true };
    }
    this.sessionStates.set(sessionId, state);
    while (this.turns.has(sessionId)) {
      if (!continuity?.interruptActive) {
        throw new Error("Maker is already working.");
      }
      const active = this.turns.get(sessionId)!;
      this.cancelSession(sessionId, true);
      await active.finished;
    }
    let resolveFinished!: () => void;
    const finished = new Promise<void>((resolve) => {
      resolveFinished = resolve;
    });
    const turn: ActiveTurn = {
      requestId,
      reply: "",
      replySegments: [],
      sawToolCall: false,
      mutationObserved: false,
      activeToolIds: new Set(),
      onEvent,
      finished,
      resolveFinished,
      health: {
        state: "working",
        turnStartedAt,
        lastProviderEventAt: null,
        lastToolEventAt: null,
        lastTerminalActivityAt: null,
        pendingPermissionSince: null,
        connection: "connected",
        process: "running",
        idleDeadlineAt: isoAfter(this.timing.idleTimeoutMs),
        absoluteDeadlineAt: isoAfter(this.timing.absoluteTimeoutMs),
        failure: null
      },
      idleTimer: null,
      quietTimer: null,
      absoluteTimer: null,
      rejectDeadline: null
    };
    this.turns.set(sessionId, turn);
    onEvent({ type: "health", health: turn.health });
    onEvent({ type: "session_state", state });
    if (modeSwitch?.status === "failed") {
      onEvent({
        type: "activity",
        activity: {
          id: `mode:${requestId}`,
          kind: "switch_mode",
          title: modeSwitch.title,
          status: modeSwitch.status,
          locations: [],
          updatedAt: now()
        }
      });
    }
    if (resumedPriorSession) {
      onEvent({
        type: "activity",
        activity: {
          id: `continuity:${sessionId}`,
          kind: "read",
          title: "Reopened the last Claude Code session",
          status: "completed",
          locations: [cwd],
          updatedAt: now()
        }
      });
    }
    try {
      const timedOut = new Promise<never>((_, reject) => {
        turn.rejectDeadline = reject;
        turn.absoluteTimer = setTimeout(() => {
          void connection.agent.notify(methods.agent.session.cancel, { sessionId });
          reject(new ClaudeAcpTurnDeadlineError("absolute_timeout"));
        }, this.timing.absoluteTimeoutMs);
      });
      this.renewIdleDeadline(sessionId);
      let response;
      try {
        if (requestedMode && state.availableModes.some((mode) => mode.id === requestedMode)) {
          await Promise.race([
            connection.agent.request(methods.agent.session.setMode, {
              sessionId,
              modeId: requestedMode
            }),
            timedOut
          ]);
          this.noteProviderEvent(sessionId);
          this.pendingModes.delete(sessionId);
          state = { ...state, modePending: false };
          this.sessionStates.set(sessionId, state);
          onEvent({ type: "session_state", state });
          onEvent({
            type: "activity",
            activity: {
              id: `mode:${requestId}`,
              kind: "switch_mode",
              title: `Switched to ${state.modeName}`,
              status: "completed",
              locations: [],
              updatedAt: now()
            }
          });
        }
        const requestedEffort = this.pendingEfforts.get(sessionId);
        if (requestedEffort) {
          const effort = effortOption(this.sessionConfigOptions.get(sessionId) ?? []);
          if (!effort || effort.type !== "select") {
            throw new Error("This Claude session no longer exposes an effort control.");
          }
          const configResponse = await Promise.race([
            connection.agent.request(
              methods.agent.session.setConfigOption,
              { sessionId, configId: effort.id, value: requestedEffort }
            ),
            timedOut
          ]);
          this.noteProviderEvent(sessionId);
          this.sessionConfigOptions.set(sessionId, configResponse.configOptions);
          this.pendingEfforts.delete(sessionId);
          const configState = sessionState(null, configResponse.configOptions);
          state = {
            ...state,
            effortId: configState.effortId,
            effortName: configState.effortName,
            availableEfforts: configState.availableEfforts,
            effortPending: false
          };
          this.sessionStates.set(sessionId, state);
          onEvent({ type: "session_state", state });
        }
        const promptRequest = connection.agent.request(methods.agent.session.prompt, {
          sessionId,
          prompt: [{ type: "text", text: prompt }]
        });
        response = await Promise.race([promptRequest, timedOut]);
        this.noteProviderEvent(sessionId);
      } catch (error) {
        if (!this.cancelled.has(sessionId)) {
          void connection.agent.notify(methods.agent.session.cancel, { sessionId });
        }
        if (this.cancelled.has(sessionId)) {
          turn.health = {
            ...turn.health,
            state: "interrupted",
            pendingPermissionSince: null,
            idleDeadlineAt: null,
            absoluteDeadlineAt: null,
            failure: {
              class: "interrupted",
              message: this.interrupted.has(sessionId)
                ? "A newer direction interrupted this turn."
                : "You stopped this turn.",
              fate: "The turn stopped and was not replayed.",
              retrySafe: !turn.mutationObserved
            }
          };
          onEvent({ type: "health", health: turn.health });
          throw new ClaudeAcpCancelledError(
            this.interrupted.has(sessionId) ? "interrupted" : "stopped"
          );
        }
        const failureClass: WorkshopFailureClass = error instanceof ClaudeAcpTurnDeadlineError
          ? error.failureClass
          : this.lastDisconnectClass
            ? this.lastDisconnectClass
          : this.connection
            ? "provider_error"
            : "connection_lost";
        turn.health = {
          ...turn.health,
          state: failureClass.endsWith("timeout") ? "stalled" : "failed",
          connection: this.connection ? "connected" : "disconnected",
          process: this.child && this.child.exitCode == null ? "running" : "stopped",
          pendingPermissionSince: null,
          idleDeadlineAt: null,
          absoluteDeadlineAt: null,
          failure: {
            class: failureClass,
            message: error instanceof Error ? error.message.slice(0, 320) : "Claude Code could not finish this turn.",
            fate: "The turn stopped. Hearth did not replay it.",
            retrySafe: !turn.mutationObserved
          }
        };
        this.lastError = error instanceof Error ? error.message.slice(0, 320) : "Claude Code could not finish this turn.";
        onEvent({ type: "health", health: turn.health });
        throw error;
      }
      if (response.stopReason === "cancelled") {
        turn.health = {
          ...turn.health,
          state: "interrupted",
          pendingPermissionSince: null,
          idleDeadlineAt: null,
          absoluteDeadlineAt: null,
          failure: {
            class: "interrupted",
            message: this.interrupted.has(sessionId) ? "A newer direction interrupted this turn." : "Claude Code cancelled this turn.",
            fate: "The turn stopped and was not replayed.",
            retrySafe: !turn.mutationObserved
          }
        };
        onEvent({ type: "health", health: turn.health });
        throw new ClaudeAcpCancelledError(
          this.interrupted.has(sessionId) ? "interrupted" : "stopped"
        );
      }
      const transcriptUsage = claudeTranscriptUsage(cwd, sessionId);
      if (response.usage || transcriptUsage) {
        const delta = (current: number | null | undefined, previous: number | null | undefined): number | null =>
          current == null || previous == null ? null : Math.max(0, current - previous);
        const turnUsage = {
          inputTokens: response.usage?.inputTokens ?? delta(transcriptUsage?.inputTokens, usageBaseline.inputTokens),
          outputTokens: response.usage?.outputTokens ?? delta(transcriptUsage?.outputTokens, usageBaseline.outputTokens),
          cachedReadTokens: response.usage?.cachedReadTokens ?? delta(transcriptUsage?.cachedReadTokens, usageBaseline.cachedReadTokens),
          cachedWriteTokens: response.usage?.cachedWriteTokens ?? delta(transcriptUsage?.cachedWriteTokens, usageBaseline.cachedWriteTokens)
        };
        state = {
          ...state,
          modelName: transcriptUsage?.model ?? state.modelName,
          modelSource: transcriptUsage?.model ? "reported" : state.modelSource,
          inputTokens: response.usage?.inputTokens ?? transcriptUsage?.inputTokens ?? state.inputTokens,
          outputTokens: response.usage?.outputTokens ?? transcriptUsage?.outputTokens ?? state.outputTokens,
          cachedReadTokens: response.usage?.cachedReadTokens ?? transcriptUsage?.cachedReadTokens ?? state.cachedReadTokens,
          cachedWriteTokens: response.usage?.cachedWriteTokens ?? transcriptUsage?.cachedWriteTokens ?? state.cachedWriteTokens,
          contextUsed: transcriptUsage?.contextUsed ?? state.contextUsed ?? null
        };
        this.sessionStates.set(sessionId, state);
        onEvent({ type: "session_state", state });
        onEvent({
          type: "usage",
          usage: {
            model: state.modelName ?? null,
            modelSource: state.modelSource ?? "unreported",
            inputTokens: turnUsage.inputTokens,
            outputTokens: turnUsage.outputTokens,
            cachedReadTokens: turnUsage.cachedReadTokens,
            cachedWriteTokens: turnUsage.cachedWriteTokens,
            contextUsed: state.contextUsed,
            contextSize: state.contextSize,
            estimatedPromptCharacters: prompt.length,
            reportedAt: now()
          }
        });
      }
      const finalSegment = turn.reply.trim();
      sealReplySegment(turn);
      const reply = finalSegment ||
        (!turn.sawToolCall ? turn.replySegments.at(-1)?.trim() ?? "" :
          "The run finished, but Claude didn't leave me a clean wrap-up. The workstream has the actual trail.");
      if (!reply) throw new Error("Maker returned no usable reply.");
      turn.health = {
        ...turn.health,
        state: "completed",
        pendingPermissionSince: null,
        idleDeadlineAt: null,
        absoluteDeadlineAt: null,
        failure: null
      };
      onEvent({ type: "health", health: turn.health });
      this.lastSuccessAt = now();
      this.lastError = null;
      return reply.slice(0, MAX_REPLY_CHARACTERS);
    } finally {
      this.cancelPermissionsForSession(sessionId);
      if (turn.idleTimer) clearTimeout(turn.idleTimer);
      if (turn.quietTimer) clearTimeout(turn.quietTimer);
      if (turn.absoluteTimer) clearTimeout(turn.absoluteTimer);
      this.turns.delete(sessionId);
      this.cancelled.delete(sessionId);
      this.interrupted.delete(sessionId);
      turn.resolveFinished();
    }
  }

  private renewIdleDeadline(sessionId: string): void {
    const turn = this.turns.get(sessionId);
    if (!turn) return;
    if (turn.idleTimer) clearTimeout(turn.idleTimer);
    if (turn.quietTimer) clearTimeout(turn.quietTimer);
    turn.health = {
      ...turn.health,
      idleDeadlineAt: isoAfter(this.timing.idleTimeoutMs)
    };
    turn.idleTimer = setTimeout(() => {
      if (turn.health.pendingPermissionSince || turn.activeToolIds.size > 0) {
        turn.health = {
          ...turn.health,
          state: turn.health.pendingPermissionSince ? "waiting_for_user" : "quiet_connected",
          failure: null
        };
        this.renewIdleDeadline(sessionId);
        turn.onEvent({ type: "health", health: turn.health });
        return;
      }
      turn.health = {
        ...turn.health,
        state: "stalled",
        connection: this.connection ? "connected" : "disconnected",
        failure: {
          class: "idle_timeout",
          message: "No provider or tool activity arrived before the idle deadline.",
          fate: "The turn was cancelled. Hearth did not replay it.",
          retrySafe: !turn.mutationObserved
        }
      };
      turn.onEvent({ type: "health", health: turn.health });
      turn.rejectDeadline?.(new ClaudeAcpTurnDeadlineError("idle_timeout"));
    }, this.timing.idleTimeoutMs);
    turn.quietTimer = setTimeout(() => {
      if (turn.health.pendingPermissionSince || turn.health.state !== "working") return;
      turn.health = { ...turn.health, state: "quiet_connected" };
      turn.onEvent({ type: "health", health: turn.health });
    }, this.timing.quietAfterMs);
  }

  private noteProviderEvent(sessionId: string, tool = false): void {
    const turn = this.turns.get(sessionId);
    if (!turn) return;
    const timestamp = now();
    turn.health = {
      ...turn.health,
      state: turn.health.pendingPermissionSince ? "waiting_for_user" : "working",
      lastProviderEventAt: timestamp,
      lastToolEventAt: tool ? timestamp : turn.health.lastToolEventAt,
      connection: "connected",
      process: "running",
      failure: null
    };
    this.renewIdleDeadline(sessionId);
    turn.onEvent({ type: "health", health: turn.health });
  }

  resolvePermission(permissionId: string, optionId: string): boolean {
    const pending = this.permissions.get(permissionId);
    if (!pending) return false;
    const selected = pending.options.find((option) => option.optionId === optionId);
    if (!selected) return false;
    clearTimeout(pending.timeout);
    this.permissions.delete(permissionId);
    pending.resolve({ outcome: { outcome: "selected", optionId } });
    const turn = this.turns.get(pending.sessionId);
    if (turn) {
      turn.health = { ...turn.health, pendingPermissionSince: null, state: "working" };
      this.noteProviderEvent(pending.sessionId);
    }
    turn?.onEvent({
      type: "permission_resolved",
      permissionId,
      optionId
    });
    return true;
  }

  cancel(): boolean {
    const sessionId = this.turns.keys().next().value as string | undefined;
    if (!sessionId || !this.connection) return false;
    this.cancelSession(sessionId);
    return true;
  }

  private cancelSession(sessionId: string, interrupted = false): void {
    if (!this.connection) return;
    this.cancelled.add(sessionId);
    if (interrupted) this.interrupted.add(sessionId);
    this.cancelPermissionsForSession(sessionId);
    void this.connection.agent.notify(methods.agent.session.cancel, { sessionId });
  }

  shutdown(): void {
    for (const permissionId of this.permissions.keys()) {
      this.cancelPermission(permissionId);
    }
    this.connection?.close();
    this.child?.kill();
    this.reset();
  }

  private async ensureConnection(): Promise<ClientConnection> {
    if (this.connection && !this.connection.signal.aborted) return this.connection;
    if (this.connecting) return this.connecting;
    this.connecting = this.connect();
    try {
      return await this.connecting;
    } finally {
      this.connecting = null;
    }
  }

  private async ensureSession(
    cwd: string,
    continuity?: {
      resumeSessionId?: string | null;
      onSessionReady?: (sessionId: string) => void;
    }
  ): Promise<{
    connection: ClientConnection;
    sessionId: string;
    resumedPriorSession: boolean;
  }> {
    const connection = await this.ensureConnection();
    const rememberedSessionId = this.sessions.get(cwd);
    if (rememberedSessionId) {
      return { connection, sessionId: rememberedSessionId, resumedPriorSession: false };
    }
    let sessionId: string;
    let resumedPriorSession = false;
    if (continuity?.resumeSessionId) {
      const session = await connection.agent.request(methods.agent.session.resume, {
        sessionId: continuity.resumeSessionId,
        cwd,
        mcpServers: []
      });
      sessionId = continuity.resumeSessionId;
      resumedPriorSession = true;
      this.sessionStates.set(sessionId, sessionState(session.modes, session.configOptions));
      this.sessionConfigOptions.set(sessionId, session.configOptions ?? []);
    } else {
      const session = await connection.agent.request(methods.agent.session.new, {
        cwd,
        mcpServers: []
      });
      sessionId = session.sessionId;
      this.sessionStates.set(sessionId, sessionState(session.modes, session.configOptions));
      this.sessionConfigOptions.set(sessionId, session.configOptions ?? []);
    }
    this.sessions.set(cwd, sessionId);
    continuity?.onSessionReady?.(sessionId);
    return { connection, sessionId, resumedPriorSession };
  }

  private async connect(): Promise<ClientConnection> {
    if (!this.adapterPath || !this.claudeExecutable) {
      throw new Error("The managed Maker connection is not available.");
    }
    const child = spawn(process.execPath, [this.adapterPath], {
      cwd: process.cwd(),
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"],
      env: {
        ...process.env,
        ELECTRON_RUN_AS_NODE: "1",
        CLAUDE_CODE_EXECUTABLE: this.claudeExecutable
      }
    });
    if (!child.stdin || !child.stdout || !child.stderr) {
      child.kill();
      throw new Error("Hearth could not open Maker's managed connection.");
    }
    this.child = child;
    this.lastDisconnectClass = null;
    this.stderr = "";
    child.once("error", () => {
      this.lastDisconnectClass = "connection_lost";
    });
    child.once("exit", () => {
      this.lastDisconnectClass = "adapter_exit";
    });
    child.stderr.on("data", (chunk: Buffer) => {
      this.stderr = (this.stderr + chunk.toString("utf8")).slice(-6_000);
    });
    const app = client({ name: "Hearth" })
      .onRequest(methods.client.session.requestPermission, ({ params }) =>
        this.requestPermission(params)
      )
      .onNotification(methods.client.session.update, ({ params }) =>
        this.handleUpdate(params)
      );
    const stream = ndJsonStream(
      Writable.toWeb(child.stdin) as WritableStream<Uint8Array>,
      Readable.toWeb(child.stdout) as ReadableStream<Uint8Array>
    );
    const connection = app.connect(stream);
    try {
      await connection.agent.request(methods.agent.initialize, {
        protocolVersion: PROTOCOL_VERSION,
        clientCapabilities: {},
        clientInfo: { name: "Hearth", version: packageJson.version }
      });
    } catch (error) {
      this.lastError = error instanceof Error ? error.message : "Claude ACP handshake failed.";
      connection.close(error);
      child.kill();
      this.reset();
      throw error;
    }
    this.connection = connection;
    this.lastHandshakeAt = now();
    this.lastError = null;
    void connection.closed.then(() => {
      if (this.connection === connection) this.reset();
    });
    return connection;
  }

  private requestPermission(
    request: RequestPermissionRequest
  ): Promise<{
    outcome:
      | { outcome: "selected"; optionId: string }
      | { outcome: "cancelled" };
  }> {
    const turn = this.turns.get(request.sessionId);
    if (!turn) return Promise.resolve({ outcome: { outcome: "cancelled" } });
    const permissionId = randomUUID();
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        this.cancelPermission(permissionId);
      }, this.timing.permissionTimeoutMs);
      this.permissions.set(permissionId, {
        sessionId: request.sessionId,
        requestId: turn.requestId,
        timeout,
        options: request.options,
        resolve
      });
      turn.health = {
        ...turn.health,
        state: "waiting_for_user",
        pendingPermissionSince: now()
      };
      this.renewIdleDeadline(request.sessionId);
      turn.onEvent({ type: "health", health: turn.health });
      turn.onEvent({
        type: "permission",
        permission: {
          id: permissionId,
          toolCallId: request.toolCall.toolCallId,
          title: request.toolCall.title ?? "Maker wants to use a tool",
          kind: request.toolCall.kind ?? "other",
          options: request.options.map((option) => ({
            id: option.optionId,
            label: option.name,
            kind: option.kind
          })),
          createdAt: now()
        }
      });
    });
  }

  private handleUpdate(notification: SessionNotification): void {
    const turn = this.turns.get(notification.sessionId);
    if (!turn) return;
    const update = notification.update;
    this.noteProviderEvent(
      notification.sessionId,
      update.sessionUpdate === "tool_call" || update.sessionUpdate === "tool_call_update"
    );
    if (
      update.sessionUpdate === "agent_message_chunk" &&
      update.content.type === "text"
    ) {
      const used = turn.replySegments.reduce((total, segment) => total + segment.length, 0) + turn.reply.length;
      const remaining = MAX_REPLY_CHARACTERS - used;
      if (remaining <= 0) return;
      const text = update.content.text.slice(0, remaining);
      turn.reply += text;
      turn.onEvent({ type: "delta", text });
      return;
    }
    if (
      update.sessionUpdate === "agent_thought_chunk" &&
      update.content.type === "text"
    ) {
      turn.onEvent({ type: "thought", text: update.content.text });
      return;
    }
    if (update.sessionUpdate === "plan") {
      turn.onEvent({ type: "plan", entries: update.entries });
      return;
    }
    if (update.sessionUpdate === "current_mode_update") {
      const current = this.sessionStates.get(notification.sessionId) ?? sessionState();
      const next = {
        ...current,
        modeId: update.currentModeId,
        modeName:
          current.availableModes.find((mode) => mode.id === update.currentModeId)?.name ??
          (update.currentModeId in MAKER_MODE_NAMES
            ? MAKER_MODE_NAMES[update.currentModeId as keyof typeof MAKER_MODE_NAMES]
            : "Manual")
      };
      this.sessionStates.set(notification.sessionId, next);
      turn.onEvent({ type: "session_state", state: next });
      return;
    }
    if (update.sessionUpdate === "usage_update") {
      const current = this.sessionStates.get(notification.sessionId) ?? sessionState();
      const next = {
        ...current,
        contextUsed: update.used,
        contextSize: update.size
      };
      this.sessionStates.set(notification.sessionId, next);
      turn.onEvent({ type: "session_state", state: next });
      return;
    }
    if (update.sessionUpdate === "config_option_update") {
      const current = this.sessionStates.get(notification.sessionId) ?? sessionState();
      const configState = sessionState(null, update.configOptions);
      const next = {
        ...current,
        modelId: configState.modelId,
        modelName: configState.modelName,
        modelSource: configState.modelSource,
        effortId: configState.effortId,
        effortName: configState.effortName,
        availableEfforts: configState.availableEfforts
      };
      this.sessionConfigOptions.set(notification.sessionId, update.configOptions);
      this.sessionStates.set(notification.sessionId, next);
      turn.onEvent({ type: "session_state", state: next });
      return;
    }
    if (update.sessionUpdate === "tool_call") {
      sealReplySegment(turn);
      turn.sawToolCall = true;
      turn.onEvent({ type: "reply_boundary" });
      const activity = normalizeClaudeToolActivity(update);
      if (["edit", "delete", "move", "execute"].includes(activity.kind)) turn.mutationObserved = true;
      if (activity.status === "pending" || activity.status === "in_progress") {
        turn.activeToolIds.add(activity.id);
      }
      this.activities.set(activity.id, activity);
      turn.onEvent({ type: "activity", activity });
      return;
    }
    if (update.sessionUpdate === "tool_call_update") {
      const activity = normalizeClaudeToolActivity(update, this.activities.get(update.toolCallId));
      if (["edit", "delete", "move", "execute"].includes(activity.kind)) turn.mutationObserved = true;
      if (activity.status === "pending" || activity.status === "in_progress") {
        turn.activeToolIds.add(activity.id);
      } else {
        turn.activeToolIds.delete(activity.id);
      }
      this.activities.set(activity.id, activity);
      turn.onEvent({ type: "activity", activity });
    }
  }

  reportedModel(cwd: string): string | null {
    const sessionId = this.sessions.get(cwd);
    if (!sessionId) return null;
    const state = this.sessionStates.get(sessionId);
    return state?.modelSource === "reported" ? state.modelName ?? null : null;
  }

  private cancelPermission(permissionId: string): void {
    const pending = this.permissions.get(permissionId);
    if (!pending) return;
    clearTimeout(pending.timeout);
    this.permissions.delete(permissionId);
    const turn = this.turns.get(pending.sessionId);
    if (turn) {
      turn.health = {
        ...turn.health,
        state: "working",
        pendingPermissionSince: null
      };
      this.noteProviderEvent(pending.sessionId);
    }
    pending.resolve({ outcome: { outcome: "cancelled" } });
  }

  private cancelPermissionsForSession(sessionId: string): void {
    for (const [permissionId, pending] of this.permissions) {
      if (pending.sessionId === sessionId) this.cancelPermission(permissionId);
    }
  }

  private reset(): void {
    for (const [permissionId, pending] of this.permissions) {
      clearTimeout(pending.timeout);
      this.permissions.delete(permissionId);
      pending.resolve({ outcome: { outcome: "cancelled" } });
    }
    this.connection = null;
    const child = this.child;
    this.child = null;
    if (child && child.exitCode == null && !child.killed) child.kill();
    this.sessions.clear();
    this.turns.clear();
    this.activities.clear();
    this.sessionStates.clear();
    this.sessionConfigOptions.clear();
    this.pendingModes.clear();
    this.pendingEfforts.clear();
    this.cancelled.clear();
    this.interrupted.clear();
  }
}
