import { spawn, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { Readable, Writable } from "node:stream";
import {
  client,
  methods,
  ndJsonStream,
  PROTOCOL_VERSION,
  type ClientConnection,
  type SessionNotification
} from "@agentclientprotocol/sdk";
import packageJson from "../../package.json";

const TURN_TIMEOUT_MS = 120_000;
const MAX_REPLY_CHARACTERS = 12_000;

interface ActiveTurn {
  reply: string;
  onDelta?: (text: string) => void;
}

export class CodexAcpCancelledError extends Error {
  constructor() {
    super("The Codex review was stopped.");
    this.name = "CodexAcpCancelledError";
  }
}

function adapterCandidates(): string[] {
  const relative = path.join(
    "node_modules",
    "@agentclientprotocol",
    "codex-acp",
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

export function findCodexAcpAdapter(): string | null {
  return adapterCandidates().find((candidate) => existsSync(candidate)) ?? null;
}

function bundledCodexCandidates(): string[] {
  const architecture = process.arch === "arm64" ? "aarch64" : "x86_64";
  const packageArchitecture = process.arch === "arm64" ? "arm64" : "x64";
  const relative = path.join(
    "node_modules",
    "@openai",
    `codex-win32-${packageArchitecture}`,
    "vendor",
    `${architecture}-pc-windows-msvc`,
    "bin",
    "codex.exe"
  );
  const resourcesPath = (process as NodeJS.Process & { resourcesPath?: string })
    .resourcesPath;
  return [
    resourcesPath ? path.join(resourcesPath, "app.asar.unpacked", relative) : "",
    path.resolve(process.cwd(), relative),
    typeof __dirname === "string" ? path.resolve(__dirname, "..", "..", relative) : ""
  ].filter(Boolean);
}

export function findBundledCodex(): string | null {
  return bundledCodexCandidates().find((candidate) => existsSync(candidate)) ?? null;
}

export function codexSessionKey(cwd: string, namespace = "resident"): string {
  return `${namespace}\u0000${path.resolve(cwd).toLocaleLowerCase()}`;
}

function updateText(notification: SessionNotification): string | null {
  const update = notification.update;
  return update.sessionUpdate === "agent_message_chunk" &&
    update.content.type === "text"
    ? update.content.text
    : null;
}

export class CodexAcpRuntime {
  readonly adapterPath = findCodexAcpAdapter();
  private child: ChildProcess | null = null;
  private connection: ClientConnection | null = null;
  private connecting: Promise<ClientConnection> | null = null;
  private sessions = new Map<string, string>();
  private turns = new Map<string, ActiveTurn>();
  private cancelled = new Set<string>();
  private stderr = "";

  get available(): boolean {
    return Boolean(this.adapterPath);
  }

  async reason(
    cwd: string,
    prompt: string,
    onDelta?: (text: string) => void,
    namespace = "resident"
  ): Promise<string> {
    const connection = await this.ensureConnection();
    const sessionKey = codexSessionKey(cwd, namespace);
    let sessionId = this.sessions.get(sessionKey);
    if (!sessionId) {
      const session = await connection.agent.request(methods.agent.session.new, {
        cwd,
        mcpServers: []
      });
      sessionId = session.sessionId;
      this.sessions.set(sessionKey, sessionId);
    }
    if (this.turns.has(sessionId)) {
      throw new Error("Critic is already thinking.");
    }
    const turn: ActiveTurn = { reply: "", onDelta };
    this.turns.set(sessionId, turn);
    let timeout: ReturnType<typeof setTimeout> | null = null;
    try {
      const timedOut = new Promise<never>((_, reject) => {
        timeout = setTimeout(() => {
          void connection.agent.notify(methods.agent.session.cancel, { sessionId });
          reject(new Error("Codex took too long to answer."));
        }, TURN_TIMEOUT_MS);
      });
      let response;
      try {
        response = await Promise.race([
          connection.agent.request(methods.agent.session.prompt, {
            sessionId,
            prompt: [{ type: "text", text: prompt }]
          }),
          timedOut
        ]);
      } catch (error) {
        if (this.cancelled.has(sessionId)) throw new CodexAcpCancelledError();
        throw error;
      }
      if (response.stopReason === "cancelled") {
        throw new CodexAcpCancelledError();
      }
      const reply = turn.reply.trim();
      if (!reply) throw new Error("Codex returned no usable reply.");
      return reply.slice(0, MAX_REPLY_CHARACTERS);
    } finally {
      if (timeout) clearTimeout(timeout);
      this.turns.delete(sessionId);
      this.cancelled.delete(sessionId);
    }
  }

  cancel(): boolean {
    const sessionId = this.turns.keys().next().value as string | undefined;
    if (!sessionId || !this.connection) return false;
    this.cancelled.add(sessionId);
    void this.connection.agent.notify(methods.agent.session.cancel, { sessionId });
    return true;
  }

  shutdown(): void {
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

  private async connect(): Promise<ClientConnection> {
    if (!this.adapterPath) {
      throw new Error("The Codex ACP adapter is not available.");
    }
    const bundledCodex = findBundledCodex();
    const child = spawn(process.execPath, [this.adapterPath], {
      cwd: process.cwd(),
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"],
      env: {
        ...process.env,
        ELECTRON_RUN_AS_NODE: "1",
        INITIAL_AGENT_MODE: "read-only",
        NO_BROWSER: "1",
        ...(bundledCodex ? { CODEX_PATH: bundledCodex } : {})
      }
    });
    if (!child.stdin || !child.stdout || !child.stderr) {
      child.kill();
      throw new Error("Hearth could not open the Codex ACP connection.");
    }
    this.child = child;
    this.stderr = "";
    child.stderr.on("data", (chunk: Buffer) => {
      this.stderr = (this.stderr + chunk.toString("utf8")).slice(-4_000);
    });
    const app = client({ name: "Hearth" })
      .onRequest(methods.client.session.requestPermission, () => ({
        outcome: { outcome: "cancelled" }
      }))
      .onNotification(methods.client.session.update, ({ params }) => {
        const text = updateText(params);
        if (!text) return;
        const turn = this.turns.get(params.sessionId);
        if (!turn) return;
        const remaining = MAX_REPLY_CHARACTERS - turn.reply.length;
        if (remaining <= 0) return;
        const bounded = text.slice(0, remaining);
        turn.reply += bounded;
        turn.onDelta?.(bounded);
      });
    const stream = ndJsonStream(
      Writable.toWeb(child.stdin) as WritableStream<Uint8Array>,
      Readable.toWeb(child.stdout) as ReadableStream<Uint8Array>
    );
    const connection = app.connect(stream);
    const failed = new Promise<never>((_, reject) => {
      child.once("error", reject);
      child.once("exit", (code) => {
        reject(
          new Error(
            this.stderr.trim() || `The Codex ACP adapter exited with code ${code}.`
          )
        );
      });
    });
    try {
      await Promise.race([
        connection.agent.request(methods.agent.initialize, {
          protocolVersion: PROTOCOL_VERSION,
          clientCapabilities: {},
          clientInfo: { name: "Hearth", version: packageJson.version }
        }),
        failed
      ]);
    } catch (error) {
      connection.close(error);
      child.kill();
      this.reset();
      throw error;
    }
    this.connection = connection;
    void connection.closed.then(() => {
      if (this.connection === connection) this.reset();
    });
    return connection;
  }

  private reset(): void {
    this.connection = null;
    this.child = null;
    this.sessions.clear();
    this.turns.clear();
    this.cancelled.clear();
  }
}
