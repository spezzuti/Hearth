import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import type { CompanionRemoteAccessStatus } from "../shared/contracts";

interface CommandResult {
  stdout: string;
  stderr: string;
}

export type TailscaleCommandRunner = (args: string[]) => Promise<CommandResult>;

interface TailscaleNodeStatus {
  BackendState?: string;
  Self?: {
    DNSName?: string;
  };
}

interface TailscaleServeStatus {
  TCP?: Record<string, { HTTPS?: boolean }>;
  Web?: Record<
    string,
    {
      Handlers?: Record<string, { Proxy?: string }>;
    }
  >;
}

function findTailscale(): string {
  if (process.env.HEARTH_TAILSCALE_EXECUTABLE) {
    return process.env.HEARTH_TAILSCALE_EXECUTABLE;
  }
  const installed = path.join(
    process.env.ProgramFiles ?? "C:\\Program Files",
    "Tailscale",
    "tailscale.exe"
  );
  return existsSync(installed) ? installed : "tailscale";
}

function defaultRunner(args: string[]): Promise<CommandResult> {
  return new Promise((resolve, reject) => {
    execFile(
      findTailscale(),
      args,
      {
        encoding: "utf8",
        timeout: 8_000,
        windowsHide: true,
        maxBuffer: 512 * 1024
      },
      (error, stdout, stderr) => {
        if (error) {
          reject(
            new Error(
              String(stderr).trim() ||
                error.message ||
                "Tailscale did not respond."
            )
          );
          return;
        }
        resolve({ stdout: String(stdout), stderr: String(stderr) });
      }
    );
  });
}

function unavailable(
  reason: string,
  port: number
): CompanionRemoteAccessStatus {
  return {
    provider: "tailscale",
    state: "unavailable",
    installed: false,
    connected: false,
    ownedByHearth: false,
    remoteUrl: null,
    port,
    detail: reason
  };
}

export class CompanionRemoteTransport {
  private ownedByHearth = false;

  constructor(
    private readonly localPort = 47_831,
    private readonly httpsPort = 8_443,
    private readonly run: TailscaleCommandRunner = defaultRunner
  ) {}

  async status(): Promise<CompanionRemoteAccessStatus> {
    let node: TailscaleNodeStatus;
    try {
      const result = await this.run(["status", "--json"]);
      node = JSON.parse(result.stdout) as TailscaleNodeStatus;
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : String(reason);
      if (/not recognized|not found|enoent/i.test(message)) {
        return unavailable(
          "Tailscale is not installed. Local Companion access still works.",
          this.httpsPort
        );
      }
      return {
        provider: "tailscale",
        state: "failed",
        installed: true,
        connected: false,
        ownedByHearth: false,
        remoteUrl: null,
        port: this.httpsPort,
        detail: `Tailscale could not be checked: ${message}`
      };
    }

    const dnsName = node.Self?.DNSName?.replace(/\.$/, "") ?? "";
    if (node.BackendState !== "Running" || !dnsName) {
      return {
        provider: "tailscale",
        state: "signed-out",
        installed: true,
        connected: false,
        ownedByHearth: false,
        remoteUrl: null,
        port: this.httpsPort,
        detail: "Open Tailscale and sign in before sharing Companion privately."
      };
    }

    const remoteUrl = `https://${dnsName}${
      this.httpsPort === 443 ? "" : `:${this.httpsPort}`
    }`;
    let serve: TailscaleServeStatus;
    try {
      const result = await this.run(["serve", "status", "--json"]);
      serve = JSON.parse(result.stdout || "{}") as TailscaleServeStatus;
    } catch (reason) {
      return {
        provider: "tailscale",
        state: "failed",
        installed: true,
        connected: true,
        ownedByHearth: this.ownedByHearth,
        remoteUrl: null,
        port: this.httpsPort,
        detail:
          reason instanceof Error
            ? reason.message
            : "Tailscale Serve could not be checked."
      };
    }

    const target = `http://127.0.0.1:${this.localPort}`;
    const tcp = serve.TCP?.[String(this.httpsPort)];
    const webEntries = Object.entries(serve.Web ?? {}).filter(([host]) =>
      host.endsWith(`:${this.httpsPort}`)
    );
    const handlers = webEntries.flatMap(([, value]) =>
      Object.entries(value.Handlers ?? {})
    );
    const exact =
      Boolean(tcp?.HTTPS) &&
      webEntries.length === 1 &&
      handlers.length === 1 &&
      handlers[0]?.[0] === "/" &&
      handlers[0]?.[1].Proxy === target;
    const occupied = Boolean(tcp || webEntries.length);

    if (exact) {
      return {
        provider: "tailscale",
        state: "active",
        installed: true,
        connected: true,
        ownedByHearth: this.ownedByHearth,
        remoteUrl,
        port: this.httpsPort,
        detail:
          "Available only to devices allowed onto your private Tailscale network."
      };
    }
    if (occupied) {
      return {
        provider: "tailscale",
        state: "conflict",
        installed: true,
        connected: true,
        ownedByHearth: false,
        remoteUrl: null,
        port: this.httpsPort,
        detail: `Private HTTPS port ${this.httpsPort} already belongs to another service. Hearth left it untouched.`
      };
    }
    return {
      provider: "tailscale",
      state: "available",
      installed: true,
      connected: true,
      ownedByHearth: false,
      remoteUrl,
      port: this.httpsPort,
      detail:
        "Tailscale is ready. Hearth can share Companion privately when you ask."
    };
  }

  async enable(localReady: boolean): Promise<CompanionRemoteAccessStatus> {
    if (!localReady) {
      throw new Error("Turn Companion access on before sharing it privately.");
    }
    const before = await this.status();
    if (before.state === "active") {
      return before;
    }
    if (before.state !== "available") {
      throw new Error(before.detail);
    }

    await this.run([
      "serve",
      "--bg",
      "--yes",
      `--https=${this.httpsPort}`,
      `http://127.0.0.1:${this.localPort}`
    ]);
    this.ownedByHearth = true;
    const after = await this.status();
    if (after.state !== "active") {
      await this.run(["serve", `--https=${this.httpsPort}`, "off"]).catch(
        () => undefined
      );
      this.ownedByHearth = false;
      throw new Error("Tailscale did not confirm Hearth's private route.");
    }
    return { ...after, ownedByHearth: true };
  }

  async disable(explicit = true): Promise<CompanionRemoteAccessStatus> {
    if (!explicit && !this.ownedByHearth) {
      return this.status();
    }
    const before = await this.status();
    if (before.state !== "active" || (!explicit && !this.ownedByHearth)) {
      return before;
    }
    await this.run(["serve", `--https=${this.httpsPort}`, "off"]);
    this.ownedByHearth = false;
    return this.status();
  }
}
