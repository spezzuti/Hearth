import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import * as pty from "node-pty";
import type {
  AgentContextUpdate,
  MakerProposal,
  TerminalCapabilities,
  TerminalEvent,
  TerminalKind,
  TerminalObservation,
  TerminalOwner,
  TerminalSession,
  TerminalSnapshot
} from "../shared/contracts";
import {
  appendExecutionResultProbe,
  executionInstructionPayload,
  parseExecutionResult
} from "./execution-result";
import type { HearthStore } from "./store";
import {
  isMissingClaudeConversation,
  observeClaudeInput
} from "./terminal-state";
import {
  boundedTerminalView,
  observeTerminalText,
  sameTerminalRoot
} from "./terminal-observation";

const PROJECT_ID = "project-hearth";
const MAX_SCROLLBACK_BYTES = 512 * 1024;
const DEFAULT_COLS = 120;
const DEFAULT_ROWS = 32;

function now(): string {
  return new Date().toISOString();
}

function findExecutable(name: string): string | null {
  const result = spawnSync("where.exe", [name], {
    encoding: "utf8",
    windowsHide: true,
    timeout: 5_000
  });
  if (result.status !== 0) {
    return null;
  }
  return result.stdout
    .split(/\r?\n/)
    .map((entry) => entry.trim())
    .find(Boolean) ?? null;
}

function probeClaude(path: string | null): TerminalCapabilities {
  const shellPath =
    findExecutable("pwsh.exe") ??
    findExecutable("powershell.exe") ??
    process.env.ComSpec ??
    "powershell.exe";
  const shellName = /pwsh/i.test(shellPath) ? "PowerShell 7" : "Windows PowerShell";

  if (!path) {
    return {
      shellName,
      shellPath,
      claudeAvailable: false,
      claudePath: null,
      claudeVersion: null,
      supportsNamedSessions: false,
      supportsSessionId: false,
      supportsResume: false
    };
  }

  const version = spawnSync(path, ["--version"], {
    encoding: "utf8",
    windowsHide: true,
    timeout: 8_000
  });
  const help = spawnSync(path, ["--help"], {
    encoding: "utf8",
    windowsHide: true,
    timeout: 8_000
  });
  const helpText = `${help.stdout}\n${help.stderr}`;

  return {
    shellName,
    shellPath,
    claudeAvailable: version.status === 0,
    claudePath: path,
    claudeVersion: version.status === 0 ? version.stdout.trim() : null,
    supportsNamedSessions: helpText.includes("--name"),
    supportsSessionId: helpText.includes("--session-id"),
    supportsResume: helpText.includes("--resume")
  };
}

export class TerminalManager {
  readonly capabilities: TerminalCapabilities;
  private readonly store: HearthStore;
  private readonly getProjectRoot: () => string;
  private readonly emit: (event: TerminalEvent) => void;
  private process: pty.IPty | null = null;
  private session: TerminalSession | null;
  private scrollback = "";
  private sequence = 0;
  private truncated = false;
  private persistTimer: NodeJS.Timeout | null = null;
  private claudeInputBuffer = "";
  private resumeProbe = "";
  private observationProbe = "";
  private executionResultProbe = "";
  private trackedProposalId: string | null = null;
  private observation: TerminalObservation;

  constructor(
    store: HearthStore,
    getProjectRoot: () => string,
    emit: (event: TerminalEvent) => void
  ) {
    this.store = store;
    this.getProjectRoot = getProjectRoot;
    this.emit = emit;
    this.capabilities = probeClaude(findExecutable("claude.exe") ?? findExecutable("claude"));
    this.session = store.getLatestTerminalSession();
    this.observation = {
      state: "quiet",
      summary: "No Workshop process is running.",
      requiresInput: false,
      updatedAt: now()
    };

    if (
      this.session &&
      ["starting", "running", "waiting"].includes(this.session.lifecycle)
    ) {
      this.session = {
        ...this.session,
        lifecycle: "stopped",
        pid: null,
        exitedAt: now(),
        exitCode: null,
        claudeSessionId:
          this.session.kind === "claude" && !this.session.claudeResumable
            ? null
            : this.session.claudeSessionId,
        lastActivityAt: now()
      };
      this.store.saveTerminalSession(this.session);
    }
  }

  snapshot(): TerminalSnapshot {
    return {
      session: this.session,
      capabilities: this.capabilities,
      scrollback: this.scrollback,
      sequence: this.sequence,
      truncated: this.truncated,
      observation: this.observation
    };
  }

  isLive(): boolean {
    return Boolean(
      this.process &&
      this.session &&
      ["starting", "running", "waiting"].includes(this.session.lifecycle)
    );
  }

  belongsToProject(rootPath: string): boolean {
    return sameTerminalRoot(this.session?.cwd, rootPath);
  }

  makerTerminalView(rootPath?: string): string | null {
    if (
      !this.isLive() ||
      this.session?.owner !== "maker" ||
      (rootPath ? !this.belongsToProject(rootPath) : false)
    ) {
      return null;
    }
    return boundedTerminalView(this.scrollback);
  }

  start(kind: TerminalKind, owner: TerminalOwner): TerminalSnapshot {
    if (this.isLive()) {
      throw new Error("A Workshop session is already running.");
    }
    if (kind === "claude" && !this.capabilities.claudeAvailable) {
      throw new Error("Claude Code is not available on this machine.");
    }

    return this.spawn(kind, owner, null);
  }

  resume(owner: TerminalOwner): TerminalSnapshot {
    if (this.isLive()) {
      throw new Error("A Workshop session is already running.");
    }
    if (
      !this.session?.claudeSessionId ||
      !this.session.claudeResumable ||
      !this.capabilities.claudeAvailable ||
      !this.capabilities.supportsResume
    ) {
      throw new Error("There is no resumable Claude Code session.");
    }
    return this.spawn("claude", owner, this.session);
  }

  input(sessionId: string, data: string): void {
    const live = this.requireLive(sessionId);
    if (live.owner !== "user") {
      throw new Error("Maker currently owns this session. Take control before typing.");
    }
    if (live.kind === "claude") {
      this.observeClaudeInput(data);
    }
    this.process?.write(data);
  }

  instruction(sessionId: string, proposalId: string, text: string): void {
    const live = this.requireLive(sessionId);
    if (live.owner !== "maker") {
      throw new Error("Give Maker control before passing an instruction.");
    }
    if (live.kind !== "claude") {
      throw new Error("Maker instructions require a Claude Code session.");
    }
    const proposal = this.store.getMakerProposal(proposalId);
    if (!proposal || proposal.status !== "draft") {
      throw new Error("That Maker proposal is no longer available to pass.");
    }
    this.trackedProposalId = proposalId;
    this.executionResultProbe = "";
    this.markClaudeResumable();
    this.process?.write(executionInstructionPayload(text));
  }

  resize(sessionId: string, cols: number, rows: number): TerminalSession {
    const live = this.requireLive(sessionId);
    this.process?.resize(cols, rows);
    this.session = {
      ...live,
      cols,
      rows,
      lastActivityAt: now()
    };
    this.schedulePersist();
    this.emitState();
    return this.session;
  }

  setOwner(sessionId: string, owner: TerminalOwner): TerminalSession {
    const session = this.requireSession(sessionId);
    this.session = {
      ...session,
      owner,
      lastActivityAt: now()
    };
    this.persistNow();
    this.emitState();
    return this.session;
  }

  stopTrackingProposal(proposalId: string): void {
    if (this.trackedProposalId === proposalId) {
      this.trackedProposalId = null;
      this.executionResultProbe = "";
    }
  }

  publishProposal(
    proposal: MakerProposal,
    criticHandoff?: AgentContextUpdate
  ): void {
    this.sequence += 1;
    this.emit({
      type: "proposal",
      proposal,
      ...(criticHandoff ? { criticHandoff } : {}),
      sequence: this.sequence
    });
  }

  stop(sessionId: string): TerminalSession {
    const session = this.requireSession(sessionId);
    if (!this.isLive()) {
      return session;
    }
    this.process?.kill();
    this.process = null;
    this.session = {
      ...session,
      lifecycle: "stopped",
      pid: null,
      exitedAt: now(),
      claudeSessionId:
        session.kind === "claude" && !session.claudeResumable
          ? null
          : session.claudeSessionId,
      lastActivityAt: now()
    };
    this.persistNow();
    this.emitState();
    return this.session;
  }

  shutdown(): void {
    if (this.persistTimer) {
      clearTimeout(this.persistTimer);
      this.persistTimer = null;
    }
    if (this.session && this.isLive()) {
      this.process?.kill();
      this.process = null;
      this.session = {
        ...this.session,
        lifecycle: "stopped",
        pid: null,
        exitedAt: now(),
        claudeSessionId:
          this.session.kind === "claude" && !this.session.claudeResumable
            ? null
            : this.session.claudeSessionId,
        lastActivityAt: now()
      };
      this.store.saveTerminalSession(this.session);
      this.observation = {
        state: "quiet",
        summary: "The Workshop process stopped when Hearth closed.",
        requiresInput: false,
        updatedAt: now()
      };
    }
  }

  describeTruth(): string {
    if (!this.session) {
      return "No Workshop terminal has been started.";
    }
    if (this.isLive()) {
      const label =
        this.session.kind === "claude"
          ? `Claude Code${this.session.claudeName ? ` (${this.session.claudeName})` : ""}`
          : this.capabilities.shellName;
      return `${label} is running in Workshop under ${this.session.owner === "user" ? "your" : "Maker's"} control.`;
    }
    if (
      this.session.kind === "claude" &&
      this.session.claudeSessionId &&
      this.session.claudeResumable
    ) {
      return `The Claude Code process is stopped. Session ${this.session.claudeName ?? this.session.claudeSessionId} can be resumed.`;
    }
    return "The last Workshop terminal is stopped. No external process is running.";
  }

  describeRestartQuestion(): string {
    if (this.isLive()) {
      return "The Workshop session is still running. Reopen Workshop to continue or stop it explicitly.";
    }
    if (
      this.session?.kind === "claude" &&
      this.session.claudeSessionId &&
      this.session.claudeResumable
    ) {
      return "The Claude Code process is stopped. Resume the same named session from Workshop when you are ready.";
    }
    return "Nothing is running, so nothing needs restarting.";
  }

  private spawn(
    kind: TerminalKind,
    owner: TerminalOwner,
    resumeFrom: TerminalSession | null
  ): TerminalSnapshot {
    const timestamp = now();
    const workingRoot = resumeFrom?.cwd ?? this.getProjectRoot();
    const projectName = workingRoot.split(/[\\/]/).filter(Boolean).at(-1) ?? "Project";
    const hearthSessionId = randomUUID();
    const claudeSessionId =
      kind === "claude"
        ? resumeFrom?.claudeSessionId ??
          (this.capabilities.supportsSessionId ? randomUUID() : null)
        : null;
    const claudeName =
      kind === "claude"
        ? resumeFrom?.claudeName ??
          `Hearth Maker · ${projectName} · ${new Date().toLocaleDateString()}`
        : null;

    const executable =
      kind === "claude"
        ? this.capabilities.claudePath ?? "claude.exe"
        : this.capabilities.shellPath;
    const args =
      kind === "claude"
        ? this.claudeArguments(claudeSessionId, claudeName, Boolean(resumeFrom))
        : ["-NoLogo"];

    this.scrollback = "";
    this.sequence = 0;
    this.truncated = false;
    this.claudeInputBuffer = "";
    this.resumeProbe = "";
    this.observationProbe = "";
    this.executionResultProbe = "";
    this.trackedProposalId =
      kind === "claude" && resumeFrom
        ? (() => {
            const proposal = this.store.getActiveMakerProposal();
            return proposal?.status === "passed" && !proposal.executionResult
              ? proposal.id
              : null;
          })()
        : null;
    this.observation = {
      state: "working",
      summary: kind === "claude" ? "Claude Code is starting." : "PowerShell is starting.",
      requiresInput: false,
      updatedAt: timestamp
    };
    this.session = {
      id: hearthSessionId,
      projectId: PROJECT_ID,
      cwd: workingRoot,
      pid: null,
      kind,
      owner,
      lifecycle: "starting",
      startedAt: timestamp,
      lastActivityAt: timestamp,
      exitedAt: null,
      exitCode: null,
      claudeSessionId,
      claudeName,
      claudeResumable: resumeFrom?.claudeResumable ?? false,
      cols: resumeFrom?.cols ?? DEFAULT_COLS,
      rows: resumeFrom?.rows ?? DEFAULT_ROWS
    };
    this.store.saveTerminalSession(this.session);
    this.emitState();

    try {
      const environment = Object.fromEntries(
        Object.entries({
          ...process.env,
          TERM: "xterm-256color",
          COLORTERM: "truecolor",
          FORCE_COLOR: "1"
        }).filter((entry): entry is [string, string] => typeof entry[1] === "string")
      );
      this.process = pty.spawn(executable, args, {
        name: "xterm-256color",
        cols: this.session.cols,
        rows: this.session.rows,
        cwd: workingRoot,
        env: environment,
        useConpty: true
      });
      this.session = {
        ...this.session,
        pid: this.process.pid,
        lifecycle: "running",
        lastActivityAt: now()
      };
      this.store.saveTerminalSession(this.session);
      this.emitState();

      const activeSessionId = hearthSessionId;
      this.process.onData((data) => {
        if (this.session?.id !== activeSessionId) {
          return;
        }
        if (!this.session.pid && this.process && this.process.pid > 0) {
          this.session = {
            ...this.session,
            pid: this.process.pid,
            lastActivityAt: now()
          };
          this.store.saveTerminalSession(this.session);
          this.emitState();
        }
        this.observeResumeOutput(data);
        this.observeOutput(data);
        this.observeExecutionResult(data);
        this.appendOutput(data);
      });
      this.process.onExit(({ exitCode }) => {
        if (this.session?.id !== activeSessionId) {
          return;
        }
        this.process = null;
        this.session = {
          ...this.session,
          lifecycle: exitCode === 0 ? "stopped" : "failed",
          pid: null,
          exitedAt: now(),
          exitCode,
          claudeSessionId:
            this.session.kind === "claude" && !this.session.claudeResumable
              ? null
              : this.session.claudeSessionId,
          lastActivityAt: now()
        };
        this.persistNow();
        this.setObservation({
          state: exitCode === 0 ? "quiet" : "failed",
          summary:
            exitCode === 0
              ? "The Workshop process stopped."
              : `The Workshop process exited with code ${exitCode}.`,
          requiresInput: false,
          updatedAt: now()
        });
        this.emitState();
      });
    } catch (error) {
      this.process = null;
      this.session = {
        ...this.session,
        lifecycle: "failed",
        pid: null,
        exitedAt: now(),
        claudeSessionId:
          this.session.kind === "claude" && !this.session.claudeResumable
            ? null
            : this.session.claudeSessionId,
        lastActivityAt: now()
      };
      this.store.saveTerminalSession(this.session);
      this.setObservation({
        state: "failed",
        summary: "The Workshop process could not start.",
        requiresInput: false,
        updatedAt: now()
      });
      this.emitState();
      throw error;
    }

    return this.snapshot();
  }

  private claudeArguments(
    sessionId: string | null,
    sessionName: string | null,
    resume: boolean
  ): string[] {
    const args: string[] = [];
    if (resume && sessionId && this.capabilities.supportsResume) {
      args.push("--resume", sessionId);
    } else if (sessionId && this.capabilities.supportsSessionId) {
      args.push("--session-id", sessionId);
    }
    if (sessionName && this.capabilities.supportsNamedSessions) {
      args.push("--name", sessionName);
    }
    return args;
  }

  private observeClaudeInput(data: string): void {
    const observation = observeClaudeInput(this.claudeInputBuffer, data);
    this.claudeInputBuffer = observation.buffer;
    if (observation.submitted) {
      this.markClaudeResumable();
    }
  }

  private markClaudeResumable(): void {
    if (
      !this.session ||
      this.session.kind !== "claude" ||
      !this.session.claudeSessionId ||
      this.session.claudeResumable
    ) {
      return;
    }
    this.session = {
      ...this.session,
      claudeResumable: true,
      lastActivityAt: now()
    };
    this.store.saveTerminalSession(this.session);
    this.emitState();
  }

  private observeResumeOutput(data: string): void {
    if (
      !this.session ||
      this.session.kind !== "claude" ||
      !this.session.claudeSessionId
    ) {
      return;
    }
    this.resumeProbe = `${this.resumeProbe}${data}`.slice(-1_024);
    if (!isMissingClaudeConversation(this.resumeProbe)) {
      return;
    }
    this.session = {
      ...this.session,
      claudeSessionId: null,
      claudeResumable: false,
      lastActivityAt: now()
    };
    this.store.saveTerminalSession(this.session);
    this.emitState();
  }

  private observeOutput(data: string): void {
    if (!this.session) {
      return;
    }
    const result = observeTerminalText(
      this.observationProbe,
      data,
      this.session.kind,
      now()
    );
    this.observationProbe = result.probe;
    if (
      result.observation.state === this.observation.state &&
      result.observation.summary === this.observation.summary &&
      result.observation.requiresInput === this.observation.requiresInput
    ) {
      return;
    }
    this.setObservation(result.observation);
  }

  private observeExecutionResult(data: string): void {
    if (!this.trackedProposalId) {
      return;
    }
    this.executionResultProbe = appendExecutionResultProbe(
      this.executionResultProbe,
      data
    );
    const result = parseExecutionResult(this.executionResultProbe);
    if (!result) {
      return;
    }
    try {
      const proposal = this.store.recordMakerExecutionResult(
        this.trackedProposalId,
        result
      );
      this.sequence += 1;
      this.emit({
        type: "proposal",
        proposal,
        sequence: this.sequence
      });
      this.setObservation({
        state: "attention",
        summary: "Claude Code reported back",
        requiresInput: true,
        updatedAt: now()
      });
    } catch {
      // The user may have deliberately stopped tracking while Claude was finishing.
    } finally {
      this.trackedProposalId = null;
      this.executionResultProbe = "";
    }
  }

  private setObservation(observation: TerminalObservation): void {
    this.observation = observation;
    this.sequence += 1;
    this.emit({
      type: "observation",
      observation,
      sequence: this.sequence
    });
  }

  private appendOutput(data: string): void {
    if (!this.session) {
      return;
    }
    this.scrollback += data;
    if (Buffer.byteLength(this.scrollback, "utf8") > MAX_SCROLLBACK_BYTES) {
      const buffer = Buffer.from(this.scrollback, "utf8");
      this.scrollback = buffer.subarray(buffer.length - MAX_SCROLLBACK_BYTES).toString("utf8");
      this.truncated = true;
    }
    this.sequence += 1;
    this.session = {
      ...this.session,
      lastActivityAt: now()
    };
    this.schedulePersist();
    this.emit({
      type: "output",
      sessionId: this.session.id,
      data,
      sequence: this.sequence
    });
  }

  private requireSession(sessionId: string): TerminalSession {
    if (!this.session || this.session.id !== sessionId) {
      throw new Error("That Workshop session is no longer current.");
    }
    return this.session;
  }

  private requireLive(sessionId: string): TerminalSession {
    const session = this.requireSession(sessionId);
    if (!this.isLive()) {
      throw new Error("The Workshop session is not running.");
    }
    return session;
  }

  private emitState(): void {
    this.sequence += 1;
    this.emit({
      type: "state",
      session: this.session,
      sequence: this.sequence
    });
  }

  private schedulePersist(): void {
    if (this.persistTimer) {
      return;
    }
    this.persistTimer = setTimeout(() => {
      this.persistTimer = null;
      this.persistNow();
    }, 2_000);
  }

  private persistNow(): void {
    if (this.persistTimer) {
      clearTimeout(this.persistTimer);
      this.persistTimer = null;
    }
    if (this.session) {
      this.store.saveTerminalSession(this.session);
    }
  }
}
