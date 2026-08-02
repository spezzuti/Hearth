import { describe, expect, it } from "vitest";
import {
  CompanionRemoteTransport,
  type TailscaleCommandRunner
} from "../../src/main/companion-transport";

function runnerFixture(options?: {
  backend?: string;
  dnsName?: string;
  existingPort?: number;
  existingTarget?: string;
}): {
  run: TailscaleCommandRunner;
  calls: string[][];
} {
  const calls: string[][] = [];
  let servedPort = options?.existingPort ?? null;
  let servedTarget = options?.existingTarget ?? null;
  const dnsName = options?.dnsName ?? "hearth-pc.example.ts.net.";

  return {
    calls,
    run: async (args) => {
      calls.push(args);
      if (args[0] === "status") {
        return {
          stdout: JSON.stringify({
            BackendState: options?.backend ?? "Running",
            Self: { DNSName: dnsName }
          }),
          stderr: ""
        };
      }
      if (args.join(" ") === "serve status --json") {
        if (!servedPort || !servedTarget) {
          return { stdout: "{}", stderr: "" };
        }
        return {
          stdout: JSON.stringify({
            TCP: { [servedPort]: { HTTPS: true } },
            Web: {
              [`hearth-pc.example.ts.net:${servedPort}`]: {
                Handlers: { "/": { Proxy: servedTarget } }
              }
            }
          }),
          stderr: ""
        };
      }
      if (args[0] === "serve" && args.includes("--bg")) {
        servedPort = Number(
          args.find((argument) => argument.startsWith("--https="))?.split("=")[1]
        );
        servedTarget = args.at(-1) ?? null;
        return { stdout: "Available within your tailnet", stderr: "" };
      }
      if (args[0] === "serve" && args.at(-1) === "off") {
        servedPort = null;
        servedTarget = null;
        return { stdout: "", stderr: "" };
      }
      throw new Error(`Unexpected Tailscale command: ${args.join(" ")}`);
    }
  };
}

describe("CompanionRemoteTransport", () => {
  it("detects a connected tailnet without changing its configuration", async () => {
    const fixture = runnerFixture();
    const transport = new CompanionRemoteTransport(47_831, 8_443, fixture.run);

    await expect(transport.status()).resolves.toMatchObject({
      state: "available",
      connected: true,
      remoteUrl: "https://hearth-pc.example.ts.net:8443"
    });
    expect(fixture.calls).toEqual([
      ["status", "--json"],
      ["serve", "status", "--json"]
    ]);
  });

  it("adds and removes only Hearth's private HTTPS port", async () => {
    const fixture = runnerFixture();
    const transport = new CompanionRemoteTransport(47_831, 8_443, fixture.run);

    await expect(transport.enable(true)).resolves.toMatchObject({
      state: "active",
      ownedByHearth: true
    });
    expect(fixture.calls).toContainEqual([
      "serve",
      "--bg",
      "--yes",
      "--https=8443",
      "http://127.0.0.1:47831"
    ]);

    await expect(transport.disable(true)).resolves.toMatchObject({
      state: "available",
      ownedByHearth: false
    });
    expect(fixture.calls).toContainEqual(["serve", "--https=8443", "off"]);
  });

  it("refuses to overwrite another service on Hearth's private port", async () => {
    const fixture = runnerFixture({
      existingPort: 8_443,
      existingTarget: "http://127.0.0.1:9000"
    });
    const transport = new CompanionRemoteTransport(47_831, 8_443, fixture.run);

    await expect(transport.status()).resolves.toMatchObject({
      state: "conflict",
      remoteUrl: null
    });
    await expect(transport.enable(true)).rejects.toThrow(
      "already belongs to another service"
    );
    expect(fixture.calls.some((args) => args.includes("--bg"))).toBe(false);
  });

  it("requires the local Companion before creating a private route", async () => {
    const fixture = runnerFixture();
    const transport = new CompanionRemoteTransport(47_831, 8_443, fixture.run);

    await expect(transport.enable(false)).rejects.toThrow(
      "Turn Companion access on"
    );
    expect(fixture.calls).toHaveLength(0);
  });

  it("reports signed-out and missing clients without attempting Serve", async () => {
    const signedOut = runnerFixture({ backend: "Stopped" });
    await expect(
      new CompanionRemoteTransport(47_831, 8_443, signedOut.run).status()
    ).resolves.toMatchObject({ state: "signed-out", connected: false });
    expect(signedOut.calls).toHaveLength(1);

    const missing = new CompanionRemoteTransport(
      47_831,
      8_443,
      async () => {
        throw new Error("spawn tailscale ENOENT");
      }
    );
    await expect(missing.status()).resolves.toMatchObject({
      state: "unavailable",
      installed: false
    });
  });
});
