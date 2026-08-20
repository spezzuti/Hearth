import { _electron as electron } from "@playwright/test";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const dataDirectory = await mkdtemp(path.join(os.tmpdir(), "hearth-claude-mode-"));
let app;

function stripTerminal(text) {
  return text
    .replace(/\x1b\][^\x07]*(?:\x07|\x1b\\)/g, "")
    .replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, "")
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, "")
    .replace(/\r/g, "")
    .trim();
}

async function terminalText(page) {
  return stripTerminal(
    await page.locator(".xterm-accessibility-tree").innerText()
  );
}

function terminalMode(text) {
  const matches = [
    ...text.matchAll(/\b(manual|accept edits|auto|plan)(?: mode)? on\b/gi)
  ];
  return matches.at(-1)?.[1].toLowerCase() ?? null;
}

try {
  const executablePath = process.env.HEARTH_MODE_SMOKE_EXECUTABLE;
  app = await electron.launch({
    ...(executablePath ? { executablePath: path.resolve(executablePath) } : { args: ["."] }),
    env: {
      ...process.env,
      HEARTH_DATA_DIR: dataDirectory,
      HEARTH_PROJECT_ROOT: process.cwd(),
      HEARTH_HOME_ROOT: process.env.USERPROFILE ?? process.cwd(),
      HEARTH_AGENT_PROVIDER: "local",
      HEARTH_TAILSCALE_EXECUTABLE: "__hearth_mode_smoke_missing_tailscale__"
    }
  });
  const page = await app.firstWindow();
  await page.waitForLoadState("domcontentloaded");
  await page.getByLabel("Rooms").getByRole("button", { name: /Workshop/ }).click();
  await page.getByRole("button", { name: "Start Claude Code", exact: true }).click();

  const terminal = page.locator(".terminal-host");
  await terminal.waitFor({ state: "visible", timeout: 20_000 });
  await terminal.click();
  await page.waitForTimeout(5_000);
  let before = "";
  for (let attempt = 0; attempt < 40; attempt += 1) {
    before = await terminalText(page);
    if (terminalMode(before) !== null) break;
    await page.waitForTimeout(250);
  }
  const beforeMode = terminalMode(before);
  if (beforeMode === null) {
    throw new Error(`Claude Code did not expose its permission mode:\n${before}`);
  }

  // Reproduce the real regression instead of testing only xterm's happy path:
  // Chromium focus has escaped onto a Workshop control before Shift+Tab.
  await page.locator(".stop-session").focus();

  await page.evaluate(() => {
    globalThis.__hearthModeKeyEvents = [];
    const record = (event) => {
      if (event.key === "Tab") {
        globalThis.__hearthModeKeyEvents.push({
          type: event.type,
          shiftKey: event.shiftKey,
          target: event.target?.className ?? "",
          prevented: event.defaultPrevented
        });
      }
    };
    document.addEventListener("keydown", record, true);
    document.addEventListener("keyup", record, true);
  });

  await page.keyboard.press("Shift+Tab");
  let afterOne = before;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    afterOne = await terminalText(page);
    if (terminalMode(afterOne) !== beforeMode) break;
    await page.waitForTimeout(250);
  }
  const afterOneMode = terminalMode(afterOne);
  if (afterOneMode === null || afterOneMode === beforeMode) {
    throw new Error(`Shift+Tab did not change Claude Code mode:\n${afterOne}`);
  }

  // Let Claude finish committing the mode transition before exercising the
  // next discrete keypress. This mirrors two physical presses rather than an
  // auto-repeat burst.
  await page.waitForTimeout(300);
  await page.keyboard.press("Shift+Tab");
  let afterTwo = afterOne;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    afterTwo = await terminalText(page);
    if (terminalMode(afterTwo) !== afterOneMode) break;
    await page.waitForTimeout(250);
  }
  const afterTwoMode = terminalMode(afterTwo);
  if (afterTwoMode === null || afterTwoMode === afterOneMode) {
    const diagnostics = await page.evaluate(() => ({
      active: document.activeElement?.className ?? "",
      events: globalThis.__hearthModeKeyEvents
    }));
    throw new Error(`The second Shift+Tab did not continue the mode cycle:\n${afterTwo}\n${JSON.stringify(diagnostics)}`);
  }

  const makerMessagesBefore = (await page.evaluate(() => window.hearth.bootstrap()))
    .conversations.maker.length;
  await page.getByRole("button", { name: "Talk in Claude Code" }).click();
  await page.keyboard.type("/help");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(500);
  let afterMakerInput = afterTwo;
  for (let attempt = 0; attempt < 30; attempt += 1) {
    afterMakerInput = await terminalText(page);
    if (afterMakerInput !== afterTwo) break;
    await page.waitForTimeout(250);
  }
  if (afterMakerInput === afterTwo) {
    throw new Error("Maker's notebook did not return focus to the live Claude Code terminal.");
  }
  const makerMessagesAfter = (await page.evaluate(() => window.hearth.bootstrap()))
    .conversations.maker.length;
  if (makerMessagesAfter !== makerMessagesBefore) {
    throw new Error("Workshop created a second Maker conversation instead of using Claude Code.");
  }
  await page.keyboard.press("Escape");

  process.stdout.write(
    JSON.stringify(
      {
        before,
        afterOne,
        afterTwo,
        afterMakerInput,
        makerConversationCount: makerMessagesAfter
      },
      null,
      2
    ) + "\n"
  );
} finally {
  await app?.close().catch(() => {});
  await rm(dataDirectory, { recursive: true, force: true });
}
