import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { _electron as electron } from "playwright";

const projectRoot = path.resolve(".");
const executablePath = path.join(projectRoot, "release", "win-unpacked", "Hearth.exe");
const dataDirectory = process.env.HEARTH_PACKAGED_HEALTH_DATA ??
  path.join(projectRoot, "artifacts", `packaged-health-${randomUUID()}`);
const forbiddenPermissionFile = path.join(dataDirectory, "permission-drill-should-not-exist.txt");
const packageVersion = JSON.parse(await readFile(path.join(projectRoot, "package.json"), "utf8")).version;
const runSoak = process.env.HEARTH_HEALTH_SKIP_SOAK !== "1";
const launchEnvironment = {
  ...process.env,
  HEARTH_DATA_DIR: dataDirectory,
  HEARTH_HOME_ROOT: path.dirname(projectRoot),
  HEARTH_AGENT_PROVIDER: "claude-code",
  HEARTH_RUNTIME_TEST_TIMING: "1",
  HEARTH_TEST_TURN_IDLE_MS: "10000",
  HEARTH_TEST_TURN_QUIET_MS: "1000",
  HEARTH_TEST_TURN_ABSOLUTE_MS: "90000",
  HEARTH_TEST_PERMISSION_MS: "60000"
};

async function launch() {
  const app = await electron.launch({
    executablePath,
    args: [`--user-data-dir=${path.join(dataDirectory, "chromium")}`],
    env: launchEnvironment
  });
  const page = await app.firstWindow({ timeout: 15_000 });
  await page.waitForLoadState("domcontentloaded");
  const catalog = await page.evaluate(() => window.hearth.listWorkspaceProjects(true));
  const hearth = catalog.projects.find((project) => project.rootPath === projectRoot);
  if (!hearth) throw new Error("The packaged health drill could not discover Hearth.");
  if (catalog.selectedProject.id !== hearth.id) {
    await page.evaluate((projectId) => window.hearth.selectWorkspaceProject(projectId), hearth.id);
  }
  return { app, page };
}

function killManagedClaudeAdapter(rootPid) {
  if (!Number.isInteger(rootPid) || rootPid <= 0) {
    throw new Error(`Refusing to inspect an invalid Hearth PID: ${rootPid}`);
  }
  const discovery = String.raw`
    $hearthRootPid = ${rootPid}
    $all = @(Get-CimInstance Win32_Process)
    $ids = [System.Collections.Generic.HashSet[int]]::new()
    [void]$ids.Add($hearthRootPid)
    do {
      $added = $false
      foreach ($process in $all) {
        if ($ids.Contains([int]$process.ParentProcessId) -and -not $ids.Contains([int]$process.ProcessId)) {
          [void]$ids.Add([int]$process.ProcessId)
          $added = $true
        }
      }
    } while ($added)
    $targets = @($all | Where-Object {
      $ids.Contains([int]$_.ProcessId) -and
      $_.CommandLine -match 'claude-agent-acp[\\/]dist[\\/]index\.js'
    })
    if ($targets.Count -ne 1) {
      $descendants = @($all | Where-Object { $ids.Contains([int]$_.ProcessId) } | ForEach-Object {
        "$($_.ProcessId):$($_.ParentProcessId):$($_.Name):$($_.CommandLine)"
      }) -join [Environment]::NewLine
      throw ("Expected one Hearth Claude ACP child; found $($targets.Count). Descendants:" + [Environment]::NewLine + $descendants)
    }
    $target = $targets[0]
    [pscustomobject]@{
      pid = [int]$target.ProcessId
      parentPid = [int]$target.ParentProcessId
      command = [string]$target.CommandLine
    } | ConvertTo-Json -Compress
  `;
  const raw = execFileSync(
    "powershell.exe",
    ["-NoProfile", "-Command", discovery],
    { encoding: "utf8", timeout: 20_000, windowsHide: true }
  ).trim();
  const target = JSON.parse(raw);
  if (!Number.isInteger(target.pid) || target.pid <= 0 || !target.command.includes("claude-agent-acp")) {
    throw new Error(`Refusing to stop an unverified adapter target: ${raw}`);
  }
  execFileSync(
    "powershell.exe",
    ["-NoProfile", "-Command", `Stop-Process -Id ${target.pid} -Force`],
    { timeout: 10_000, windowsHide: true }
  );
  return target;
}

let running = await launch();
let adapterTarget = null;
let soak = null;
let adapterFailure = null;
let orphanedPermission = null;

try {
  if (runSoak) soak = await running.page.evaluate(async () => {
    const health = [];
    const activityUpdates = [];
    const remove = window.hearth.onAgentStreamEvent((event) => {
      if (event.agent !== "maker") return;
      if (event.type === "health") health.push(event.health.state);
      if (event.type === "activity") activityUpdates.push({
        id: event.activity.id,
        status: event.activity.status,
        updatedAt: event.activity.updatedAt
      });
      if (event.type === "permission") {
        const allow = event.permission.options.find((option) => option.kind === "allow_once");
        if (allow) void window.hearth.resolveMakerPermission(event.permission.id, allow.id);
      }
    });
    try {
      const update = await window.hearth.sendAgentMessage(
        "maker",
        "Run `node scripts/health-soak-child.mjs` exactly once, wait for it to finish, then reply with exactly HEARTH-SOAK-COMPLETE. Do not edit anything.",
        "workshop"
      );
      const bootstrap = await window.hearth.bootstrap();
      const turn = bootstrap.workshop.turns.at(-1);
      return {
        reply: [...update.messages].reverse().find((message) => message.role === "assistant")?.text ?? "",
        health,
        activityUpdates,
        persistedStatus: turn?.status ?? null,
        persistedHealth: turn?.health ?? null,
        usage: turn?.usage ?? null
      };
    } finally {
      remove();
    }
  });
  if (runSoak && (
    !soak.reply.includes("HEARTH-SOAK-COMPLETE") ||
    soak.persistedStatus !== "completed" ||
    soak.persistedHealth?.state !== "completed" ||
    soak.health.includes("stalled") ||
    !soak.health.includes("quiet_connected") ||
    soak.activityUpdates.length < 2 ||
    !soak.usage?.reportedAt
  )) {
    throw new Error(`The progressive health soak failed: ${JSON.stringify(soak)}`);
  }

  await running.page.evaluate(() => {
    globalThis.__hearthAdapterDrill = { started: false, settled: false, error: null };
    const remove = window.hearth.onAgentStreamEvent((event) => {
      if (
        event.agent === "maker" &&
        event.type === "activity" &&
        (event.activity.status === "pending" || event.activity.status === "in_progress")
      ) {
        globalThis.__hearthAdapterDrill.started = true;
      }
    });
    void window.hearth.sendAgentMessage(
      "maker",
      "Run `node scripts/health-soak-child.mjs` four times in sequence, wait for every run, then reply with exactly ADAPTER-DRILL-SHOULD-NOT-COMPLETE. Do not edit anything.",
      "workshop"
    ).then(
      () => { globalThis.__hearthAdapterDrill.settled = true; remove(); },
      (error) => {
        globalThis.__hearthAdapterDrill.error = error instanceof Error ? error.message : String(error);
        globalThis.__hearthAdapterDrill.settled = true;
        remove();
      }
    );
  });
  await running.page.waitForFunction(() => globalThis.__hearthAdapterDrill?.started === true, null, { timeout: 30_000 });
  adapterTarget = killManagedClaudeAdapter(running.app.process().pid);
  await running.page.waitForFunction(() => globalThis.__hearthAdapterDrill?.settled === true, null, { timeout: 30_000 });
  adapterFailure = await running.page.evaluate(async () => {
    const bootstrap = await window.hearth.bootstrap();
    const turn = bootstrap.workshop.turns.at(-1);
    return { status: turn?.status ?? null, health: turn?.health ?? null };
  });
  if (
    adapterFailure.status !== "failed" ||
    !["adapter_exit", "connection_lost"].includes(adapterFailure.health?.failure?.class) ||
    adapterFailure.health?.process !== "stopped" ||
    !adapterFailure.health?.failure?.fate?.includes("not replay")
  ) {
    throw new Error(`Adapter-loss fate was not preserved: ${JSON.stringify(adapterFailure)}`);
  }

  await running.page.evaluate(() => window.hearth.configureMakerSession({ kind: "mode", value: "default" }));
  await running.page.evaluate((targetPath) => {
    globalThis.__hearthPermissionDrill = { permission: null };
    const remove = window.hearth.onAgentStreamEvent((event) => {
      if (event.agent === "maker" && event.type === "permission") {
        globalThis.__hearthPermissionDrill.permission = event.permission.id;
        remove();
      }
    });
    void window.hearth.sendAgentMessage(
      "maker",
      `Create a new file at ${targetPath} containing PERMISSION-DRILL. Do not do anything else.`,
      "workshop"
    ).catch(() => undefined);
  }, forbiddenPermissionFile);
  await running.page.waitForFunction(() => Boolean(globalThis.__hearthPermissionDrill?.permission), null, { timeout: 45_000 });
  await running.app.close();
  running = null;

  running = await launch();
  orphanedPermission = await running.page.evaluate(async () => {
    const bootstrap = await window.hearth.bootstrap();
    const turn = bootstrap.workshop.turns.at(-1);
    return { status: turn?.status ?? null, permissions: turn?.permissions ?? [], health: turn?.health ?? null };
  });
  let forbiddenFileExists = true;
  try {
    await access(forbiddenPermissionFile);
  } catch {
    forbiddenFileExists = false;
  }
  if (
    orphanedPermission.status !== "failed" ||
    orphanedPermission.permissions.length !== 0 ||
    orphanedPermission.health?.state !== "interrupted" ||
    orphanedPermission.health?.failure?.class !== "interrupted" ||
    forbiddenFileExists
  ) {
    throw new Error(`Pending-permission relaunch cleanup failed: ${JSON.stringify({ orphanedPermission, forbiddenFileExists })}`);
  }

  console.log(JSON.stringify({
    version: packageVersion,
    soak: soak ? {
      health: soak.health,
      activityUpdates: soak.activityUpdates.length,
      persistedHealth: soak.persistedHealth,
      usage: soak.usage
    } : { skipped: true },
    adapterTarget: { pid: adapterTarget.pid, parentPid: adapterTarget.parentPid },
    adapterFailure,
    orphanedPermission
  }));
} finally {
  if (running) await running.app.close();
}
