import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { access, mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { _electron as electron } from "playwright";

const projectRoot = path.resolve(".");
const executablePath = path.join(projectRoot, "release", "win-unpacked", "Hearth.exe");
const iconPath = path.join(projectRoot, "release", "win-unpacked", "resources", "tray.ico");
const packageVersion = JSON.parse(
  await readFile(path.join(projectRoot, "package.json"), "utf8")
).version;
const dataDirectory =
  process.env.HEARTH_PACKAGED_TEST_DATA ??
  path.join(projectRoot, "artifacts", `packaged-${randomUUID()}`);
const launchEnvironment = {
  ...process.env,
  HEARTH_DATA_DIR: dataDirectory,
  HEARTH_HOME_ROOT: path.dirname(projectRoot),
  HEARTH_AGENT_PROVIDER:
    process.env.HEARTH_PACKAGED_TEST_CODEX === "1" ||
    process.env.HEARTH_PACKAGED_TEST_MAKER === "1"
      ? "claude-code"
      : "local"
};

const app = await electron.launch({
  executablePath,
  args: [
    `--user-data-dir=${path.join(dataDirectory, "chromium")}`,
    ...(process.env.HEARTH_SMOKE_DISABLE_GPU === "1" ? ["--disable-gpu"] : [])
  ],
  env: launchEnvironment
});

try {
  await access(iconPath);
  const page = await app.firstWindow({ timeout: 15_000 });
  await page.waitForLoadState("domcontentloaded");
  const discoveryStartedAt = Date.now();
  const catalog = await page.evaluate(() => window.hearth.listWorkspaceProjects(true));
  const discoveryMs = Date.now() - discoveryStartedAt;
  if (!catalog.projects.some((project) => project.rootPath === projectRoot)) {
    throw new Error("The packaged Project Surface did not discover Hearth.");
  }
  if (catalog.selectedProject.rootPath !== projectRoot) {
    throw new Error(
      `The packaged app selected ${catalog.selectedProject.rootPath} instead of the Hearth repo.`
    );
  }
  if (
    catalog.projects.some((project) =>
      project.rootPath.toLowerCase().includes("\\release\\win-unpacked")
    )
  ) {
    throw new Error("The packaged install directory was offered as a project.");
  }
  let criticProvider = null;
  let makerProvider = null;
  let makerActivities = 0;
  let makerResumed = false;
  let makerDetailedActivities = 0;
  let makerOutputActivities = 0;
  let makerPlanModeObserved = false;
  let makerTokenUsage = null;
  let makerInterrupt = null;
  if (process.env.HEARTH_PACKAGED_TEST_CODEX === "1") {
    const critic = await page.evaluate(() =>
      window.hearth.sendAgentMessage(
        "critic",
        "In one sentence, confirm whether this review connection is read-only."
      )
    );
    criticProvider = critic.provider.residents?.critic.provider ?? null;
    if (criticProvider !== "codex") {
      throw new Error(
        `The packaged Critic used ${criticProvider ?? "no provider"} instead of Codex over ACP.`
      );
    }
  }
  if (process.env.HEARTH_PACKAGED_TEST_MAKER === "1") {
    const maker = await page.evaluate(async ({ workstream }) => {
      let activities = 0;
      let resumed = false;
      let detailedActivities = 0;
      let outputActivities = 0;
      let planModeObserved = false;
      let latestSessionState = null;
      const remove = window.hearth.onAgentStreamEvent((event) => {
        if (event.agent === "maker" && event.type === "activity") {
          activities += 1;
          if (event.activity.input || event.activity.output || event.activity.diffs?.length) {
            detailedActivities += 1;
          }
          if (event.activity.output) outputActivities += 1;
          if (event.activity.title === "Reopened the last Claude Code session") {
            resumed = true;
          }
        } else if (event.agent === "maker" && event.type === "session_state") {
          latestSessionState = event.state;
          if (event.state.modeId === "plan") planModeObserved = true;
        } else if (workstream && event.agent === "maker" && event.type === "permission") {
          const allow =
            event.permission.options.find((option) => option.kind === "allow_once") ??
            event.permission.options.find((option) => option.kind === "allow_always");
          if (allow) {
            void window.hearth.resolveMakerPermission(event.permission.id, allow.id);
          }
        }
      });
      try {
        if (workstream) {
          await window.hearth.sendAgentMessage(
            "maker",
            "Switch to plan mode. Reply with one short sentence confirming the mode.",
            "workshop"
          );
          activities = 0;
          detailedActivities = 0;
          outputActivities = 0;
        }
        const update = await window.hearth.sendAgentMessage(
          "maker",
          workstream
            ? "Switch back to manual mode. Run `node -p \"require('./package.json').version\"`, then tell me only its output. Do not edit anything."
            : "Inspect package.json, then tell me only the current Hearth version. Do not edit anything.",
          "workshop"
        );
        return {
          provider: update.provider.residents?.maker.provider ?? null,
          reply: [...update.messages].reverse().find((message) => message.role === "assistant")?.text ?? "",
          activities,
          resumed,
          detailedActivities,
          outputActivities,
          planModeObserved,
          tokenUsage: latestSessionState
        };
      } finally {
        remove();
      }
    }, { workstream: process.env.HEARTH_PACKAGED_TEST_WORKSTREAM === "1" });
    makerProvider = maker.provider;
    makerActivities = maker.activities;
    makerResumed = maker.resumed;
    makerDetailedActivities = maker.detailedActivities;
    makerOutputActivities = maker.outputActivities;
    makerPlanModeObserved = maker.planModeObserved;
    makerTokenUsage = maker.tokenUsage;
    if (makerProvider !== "claude-code" || !maker.reply.includes(packageVersion)) {
      throw new Error(
        `The packaged managed Maker check failed (${makerProvider ?? "no provider"}): ${maker.reply}`
      );
    }
    if (makerActivities < 1) {
      throw new Error("Managed Maker did not publish any ACP work activity.");
    }
    if (
      !makerTokenUsage ||
      makerTokenUsage.inputTokens == null ||
      makerTokenUsage.outputTokens == null
    ) {
      throw new Error("Managed Maker did not publish Claude Code token usage.");
    }
    if (process.env.HEARTH_PACKAGED_EXPECT_RESUME === "1" && !makerResumed) {
      throw new Error("Managed Maker did not reopen its persisted Claude Code session.");
    }
    if (
      process.env.HEARTH_PACKAGED_TEST_WORKSTREAM === "1" &&
      (!makerPlanModeObserved || makerDetailedActivities < 1 || makerOutputActivities < 1)
    ) {
      throw new Error(
        `Managed Maker work stream was incomplete (plan=${makerPlanModeObserved}, detailed=${makerDetailedActivities}, output=${makerOutputActivities}).`
      );
    }
    if (process.env.HEARTH_PACKAGED_TEST_INTERRUPT === "1") {
      await page
        .getByLabel("Rooms")
        .getByRole("button", { name: /Workshop/ })
        .click();
      await page
        .getByRole("heading", { name: "Work with the process in view." })
        .waitFor();
      const composer = page.getByLabel("Message Maker");
      await composer.fill(
        "Inspect package.json, README.md, and src/core/claude-acp-runtime.ts, then explain the runtime design. Do not edit anything."
      );
      await composer.press("Enter");
      await page
        .getByPlaceholder("Interrupt Maker with a new direction…")
        .waitFor({ timeout: 15_000 });
      await composer.fill(
        "Change of direction: stop that review and reply with exactly HEARTH-INTERRUPT-OK. Do not use tools."
      );
      await page
        .getByRole("button", { name: "Interrupt and send to Maker" })
        .click();
      await page
        .getByText("HEARTH-INTERRUPT-OK", { exact: true })
        .last()
        .waitFor({ timeout: 90_000 });
      await page
        .getByText("Interrupted", { exact: true })
        .first()
        .waitFor({ timeout: 15_000 });
      makerInterrupt = await page.evaluate(async () => {
        const bootstrap = await window.hearth.bootstrap();
        const turns = bootstrap.workshop.turns.slice(-2);
        return {
          firstCancelled: turns[0]?.status === "cancelled",
          firstReason: turns[0]?.status === "cancelled" ? "interrupted" : null,
          replacementCancelled: turns[1]?.status === "cancelled",
          replacementReply:
            [...bootstrap.conversations.maker]
              .reverse()
              .find((message) => message.role === "assistant")?.text ?? ""
        };
      });
      if (
        !makerInterrupt.firstCancelled ||
        makerInterrupt.firstReason !== "interrupted" ||
        makerInterrupt.replacementCancelled ||
        !makerInterrupt.replacementReply.includes("HEARTH-INTERRUPT-OK")
      ) {
        throw new Error(
          `Managed Maker did not interrupt cleanly: ${JSON.stringify(makerInterrupt)}`
        );
      }
    }
    if (process.env.HEARTH_PACKAGED_SCREENSHOT) {
      const screenshotPath = path.resolve(process.env.HEARTH_PACKAGED_SCREENSHOT);
      await mkdir(path.dirname(screenshotPath), { recursive: true });
      await page
        .getByLabel("Rooms")
        .getByRole("button", { name: /Workshop/ })
        .click();
      await page
        .getByRole("heading", { name: "Work with the process in view." })
        .waitFor();
      const detailCards = page.locator(".managed-activity-detail");
      for (let index = 0; index < await detailCards.count(); index += 1) {
        const card = detailCards.nth(index);
        if (!(await card.getAttribute("open"))) await card.locator("summary").click();
      }
      await page.waitForTimeout(300);
      await page.screenshot({ path: screenshotPath, fullPage: true });
    }
  }
  await app.evaluate(({ BrowserWindow }) => {
    BrowserWindow.getAllWindows()[0]?.close();
  });
  const trayWindow = await app.evaluate(({ BrowserWindow }) => {
    const window = BrowserWindow.getAllWindows()[0];
    return {
      count: BrowserWindow.getAllWindows().length,
      visible: window?.isVisible() ?? true,
      destroyed: window?.isDestroyed() ?? true
    };
  });
  if (
    trayWindow.count !== 1 ||
    trayWindow.visible ||
    trayWindow.destroyed
  ) {
    throw new Error("The packaged window did not remain safely available in the tray.");
  }
  execFileSync(executablePath, [], {
    cwd: projectRoot,
    env: launchEnvironment,
    timeout: 10_000,
    windowsHide: true
  });
  const restoredByRelaunch = await app.evaluate(
    ({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0]?.isVisible() ?? false
  );
  if (!restoredByRelaunch) {
    throw new Error("Launching Hearth again did not restore the hidden working home.");
  }
  await page
    .getByLabel("Rooms")
    .getByRole("button", { name: /Workshop/ })
    .click();
  await page.getByRole("button", { name: "Terminal", exact: true }).click();
  await page
    .getByRole("button", { name: /Windows PowerShell/ })
    .first()
    .click();

  const terminal = page.locator(".terminal-host");
  await terminal.waitFor({ state: "visible", timeout: 15_000 });
  await terminal.click();
  await page.keyboard.type("Write-Output 'HEARTH-PACKAGED-PTY-OK'");
  await page.keyboard.press("Enter");

  let snapshot;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    snapshot = await page.evaluate(() => window.hearth.attachTerminal());
    if (
      snapshot.scrollback.includes("HEARTH-PACKAGED-PTY-OK") &&
      (snapshot.session?.pid ?? 0) > 0
    ) {
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  if (!snapshot?.scrollback.includes("HEARTH-PACKAGED-PTY-OK")) {
    throw new Error("Packaged PTY output was not observed.");
  }
  if ((snapshot.session?.pid ?? 0) <= 0) {
    throw new Error("Packaged PTY did not expose a real PID.");
  }
  if (snapshot.session?.cwd !== projectRoot) {
    throw new Error(`Packaged PTY started in ${snapshot.session?.cwd}.`);
  }

  const processes = await app.evaluate(({ app }) =>
    app.getAppMetrics().map((metric) => ({
      type: metric.type,
      name: metric.name,
      workingSetMb: Math.round((metric.memory.workingSetSize / 1024) * 10) / 10
    }))
  );
  console.log(
    JSON.stringify({
      title: await page.title(),
      pid: snapshot.session.pid,
      lifecycle: snapshot.session.lifecycle,
      claude: snapshot.capabilities.claudeVersion,
      projects: catalog.projects.length,
      discoveryMs,
      criticProvider,
      makerProvider,
      makerActivities,
      makerDetailedActivities,
      makerOutputActivities,
      makerPlanModeObserved,
      makerTokenUsage,
      makerInterrupt,
      workingSetMb:
        Math.round(
          processes.reduce((total, process) => total + process.workingSetMb, 0) * 10
        ) / 10,
      processes
    })
  );
} finally {
  await app.close();
}
