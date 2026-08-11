import {
  test,
  expect,
  _electron as electron,
  type ElectronApplication,
  type Page
} from "@playwright/test";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import path from "node:path";

const artifactRoot = path.resolve(
  process.env.HEARTH_E2E_ARTIFACT_ROOT ?? "artifacts"
);
const dataDirectory = path.join(artifactRoot, "e2e-data");
const screenshotDirectory = path.join(artifactRoot, "screenshots");
const e2eHome = path.join(artifactRoot, "e2e-home");
const reviewProject = path.join(e2eHome, "Review Project");
const personalOsData = path.join(e2eHome, "PersonalOS", "data");

function launchEnvironment(): Record<string, string> {
  const inherited = Object.fromEntries(
    Object.entries(process.env).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string"
    )
  );
  return {
    ...inherited,
    HEARTH_DATA_DIR: dataDirectory,
    HEARTH_PROJECT_ROOT: process.cwd(),
    HEARTH_HOME_ROOT: e2eHome,
    HEARTH_AGENT_PROVIDER: "local",
    HEARTH_COMPANION_PORT:
      process.env.HEARTH_E2E_REAL_TAILSCALE === "1"
        ? "47831"
        : "47931",
    ...(process.env.HEARTH_E2E_REAL_TAILSCALE === "1"
      ? {}
      : {
          HEARTH_TAILSCALE_EXECUTABLE:
            "__hearth_e2e_missing_tailscale__"
        })
  };
}

async function launch(): Promise<{ app: ElectronApplication; page: Page }> {
  const app = await electron.launch({
    args: ["."],
    env: launchEnvironment()
  });
  const page = await app.firstWindow();
  await page.waitForLoadState("domcontentloaded");
  return { app, page };
}

async function clipboardAvailable(page: Page): Promise<boolean> {
  const marker = `HEARTH-CLIPBOARD-PROBE-${Date.now()}`;
  return page.evaluate(async (value) => {
    try {
      await window.hearth.writeClipboard(value);
      return (await window.hearth.readClipboard()) === value;
    } catch {
      return false;
    }
  }, marker);
}

test.describe.serial("continuity vertical slice", () => {
  test.beforeAll(async () => {
    await rm(artifactRoot, { recursive: true, force: true });
    await mkdir(screenshotDirectory, { recursive: true });
    await mkdir(path.join(reviewProject, ".claude"), { recursive: true });
    await mkdir(path.join(reviewProject, "src"), { recursive: true });
    await mkdir(personalOsData, { recursive: true });
    await mkdir(path.join(e2eHome, "PersonalOS", ".claude"), { recursive: true });
    const personalOsDatabase = new DatabaseSync(
      path.join(personalOsData, "personalos.db")
    );
    personalOsDatabase.exec(`
      CREATE TABLE captures (
        id TEXT PRIMARY KEY,
        body TEXT NOT NULL,
        kind TEXT NOT NULL,
        status TEXT NOT NULL,
        tags TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );
      CREATE TABLE hold_collections (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL
      );
      CREATE TABLE hold_filings (
        capture_id TEXT PRIMARY KEY,
        collection_id TEXT NOT NULL
      );
      INSERT INTO hold_collections(id, name)
      VALUES ('design', 'Design Skills'), ('security', 'Security');
      INSERT INTO captures(id, body, kind, status, tags, created_at)
      VALUES
        ('stack-one', 'https://example.com/stacks-design A saved design field guide', 'link', 'promoted', '[]', 1785402000000),
        ('stack-two', 'https://example.com/stacks-security', 'link', 'promoted', '["read"]', 1785402060000),
        ('stack-released', 'https://example.com/stacks-released', 'link', 'archived', '[]', 1785402120000);
      INSERT INTO hold_filings(capture_id, collection_id)
      VALUES
        ('stack-one', 'design'),
        ('stack-two', 'security'),
        ('stack-released', 'design');
    `);
    personalOsDatabase.close();
    await writeFile(
      path.join(reviewProject, "package.json"),
      JSON.stringify({
        name: "review-project",
        description: "A real project fixture for Hearth's calm review surface.",
        packageManager: "npm@11"
      })
    );
    await writeFile(
      path.join(reviewProject, "src", "app.ts"),
      [
        "export function welcome(name: string): string {",
        "  return `Welcome ${name} · café Ω 漢字 🚀`;",
        "}",
        ""
      ].join("\n")
    );
    await writeFile(
      path.join(reviewProject, "src", "helper.ts"),
      [
        "export function supportGreeting(value: string): string {",
        "  return value.trim();",
        "}",
        ""
      ].join("\n")
    );
    execFileSync("git", ["init", "-b", "main"], { cwd: reviewProject, windowsHide: true });
    execFileSync("git", ["config", "user.email", "hearth@example.invalid"], {
      cwd: reviewProject,
      windowsHide: true
    });
    execFileSync("git", ["config", "user.name", "Hearth Test"], {
      cwd: reviewProject,
      windowsHide: true
    });
    execFileSync("git", ["add", "."], { cwd: reviewProject, windowsHide: true });
    execFileSync("git", ["commit", "-m", "Seed review project"], {
      cwd: reviewProject,
      windowsHide: true
    });
    await writeFile(
      path.join(reviewProject, "src", "app.ts"),
      [
        "export function welcome(name: string): string {",
        "  return `Welcome home, ${name} · café Ω 漢字 🚀`;",
        "}",
        ""
      ].join("\n")
    );
  });

  test("integrates native Windows controls without a separate menu bar", async () => {
    const running = await launch();
    try {
      const chrome = await running.app.evaluate(({ BrowserWindow }) => {
        const window = BrowserWindow.getAllWindows()[0];
        return {
          menuVisible: window?.isMenuBarVisible() ?? true,
          autoHideMenu: window?.isMenuBarAutoHide() ?? false,
          maximizable: window?.isMaximizable() ?? false
        };
      });
      expect(chrome).toEqual({
        menuVisible: false,
        autoHideMenu: true,
        maximizable: true
      });
      await expect
        .poll(() =>
          running.page.locator(".topbar").evaluate((element) =>
            getComputedStyle(element).getPropertyValue("-webkit-app-region")
          )
        )
        .toBe("drag");

      await running.app.evaluate(({ BrowserWindow }) => {
        BrowserWindow.getAllWindows()[0]?.maximize();
      });
      await expect
        .poll(() =>
          running.app.evaluate(
            ({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.isMaximized() ?? false
          )
        )
        .toBe(true);
      await running.app.evaluate(({ BrowserWindow }) => {
        BrowserWindow.getAllWindows()[0]?.restore();
      });
      await running.app.evaluate(({ BrowserWindow }) => {
        BrowserWindow.getAllWindows()[0]?.close();
      });
      await expect
        .poll(() =>
          running.app.evaluate(
            ({ BrowserWindow }) =>
              BrowserWindow.getAllWindows()[0]?.isVisible() ?? true
          )
        )
        .toBe(false);
      const executablePath = await running.app.evaluate(() => process.execPath);
      execFileSync(executablePath, ["."], {
        cwd: process.cwd(),
        env: launchEnvironment(),
        timeout: 10_000,
        windowsHide: true
      });
      await expect
        .poll(() =>
          running.app.evaluate(
            ({ BrowserWindow }) =>
              BrowserWindow.getAllWindows()[0]?.isVisible() ?? false
          )
        )
        .toBe(true);
    } finally {
      await running.app.close();
    }
  });

  test("keeps Companion access opt-in, paired, bounded, and private-ready", async () => {
    const running = await launch();
    try {
      await expect(
        running.page.getByRole("heading", { name: "Companion access" })
      ).toBeVisible();
      await expect(
        running.page.getByText(/Off by default/i)
      ).toBeVisible();
      const residentAvatars = running.page.locator(
        ".household-member .resident-avatar"
      );
      const residentPortraits = residentAvatars.locator("img");
      await expect(residentAvatars).toHaveCount(3);
      await expect(residentPortraits).toHaveCount(5);
      await expect(residentAvatars.nth(0)).toHaveAttribute(
        "data-mood",
        "present"
      );
      await expect(
        running.page.locator(
          '.household-member .resident-avatar[data-mood="present"]'
        )
      ).toHaveCount(2);
      await expect(
        running.page.locator(
          ".household-member .resident-avatar__portrait--thinking"
        )
      ).toHaveCount(2);
      await expect(
        running.page.getByText("In Library · ready to talk")
      ).toBeVisible();
      expect(
        await residentPortraits.evaluateAll((images) =>
          images.every(
            (image) =>
              (image as HTMLImageElement).complete &&
              (image as HTMLImageElement).naturalWidth > 0
          )
        )
      ).toBe(true);
      await running.page.locator(".house-memory-open").click();
      const memoryDialog = running.page.getByRole("dialog", {
        name: "What the house remembers"
      });
      await expect(memoryDialog).toBeVisible();
      await expect(memoryDialog).toContainText(
        "Practices are suggestions until you approve them"
      );
      await memoryDialog
        .getByLabel("House Memory scope")
        .selectOption("resident:maker");
      await memoryDialog
        .getByLabel("What should Hearth remember?")
        .fill("Keep work discussion casual, capable, and natural.");
      await memoryDialog
        .getByRole("button", { name: "Remember this", exact: true })
        .click();
      const savedMemory = memoryDialog
        .locator(".house-memory-card")
        .filter({ hasText: "Keep work discussion casual" });
      await expect(savedMemory).toContainText("Maker");
      await savedMemory.getByRole("button", { name: "Correct" }).click();
      await memoryDialog
        .getByLabel("What should Hearth remember?")
        .fill("Keep work discussion casual, capable, natural, and candid.");
      await memoryDialog
        .getByRole("button", { name: "Save correction" })
        .click();
      await expect(savedMemory).toContainText("natural, and candid");
      await running.app.evaluate(({ BrowserWindow }) => {
        BrowserWindow.getAllWindows()[0]?.setSize(1080, 720);
      });
      await running.page.waitForTimeout(250);
      const memoryBounds = await running.page.evaluate(() => {
        const dialog = document.querySelector<HTMLElement>(
          ".house-memory-dialog"
        );
        return {
          viewportWidth: document.documentElement.clientWidth,
          documentWidth: document.documentElement.scrollWidth,
          dialogRight: dialog?.getBoundingClientRect().right ?? 0,
          dialogHeight: dialog?.getBoundingClientRect().height ?? 0,
          viewportHeight: document.documentElement.clientHeight
        };
      });
      expect(memoryBounds.documentWidth).toBe(memoryBounds.viewportWidth);
      expect(memoryBounds.dialogRight).toBeLessThanOrEqual(
        memoryBounds.viewportWidth
      );
      expect(memoryBounds.dialogHeight).toBeLessThanOrEqual(
        memoryBounds.viewportHeight
      );
      await running.page.screenshot({
        path: path.join(screenshotDirectory, "house-memory.png"),
        fullPage: true
      });
      await memoryDialog
        .getByRole("button", { name: "Close House Memory" })
        .click();
      await running.page.getByRole("button", { name: "Search Hearth" }).click();
      await running.page.getByRole("tab", { name: "Memory" }).click();
      await running.page
        .getByRole("textbox", { name: "Search the house" })
        .fill("natural candid");
      const memoryResult = running.page
        .locator(".hearth-search-result--memory")
        .filter({ hasText: "Keep work discussion casual" });
      await expect(memoryResult).toBeVisible();
      await memoryResult.click();
      await expect(memoryDialog).toBeVisible();
      await savedMemory.getByRole("button", { name: "Forget" }).click();
      await savedMemory.getByRole("button", { name: "Forget it" }).click();
      await expect(savedMemory).not.toBeVisible();
      await memoryDialog
        .getByRole("button", { name: "Close House Memory" })
        .click();
      await expect(running.page.locator(".house-memory-open strong")).toHaveText(
        "0"
      );
      await running.page
        .getByLabel("Rooms")
        .getByRole("button", { name: /Library/ })
        .click();
      await running.page
        .getByLabel("Rooms")
        .getByRole("button", { name: /Home/ })
        .click();
      await expect(memoryDialog).not.toBeVisible();
      await running.app.evaluate(({ BrowserWindow }) => {
        BrowserWindow.getAllWindows()[0]?.setSize(1440, 900);
      });
      const alertsButton = running.page.getByRole("button", { name: "Alerts" });
      await expect(alertsButton).toHaveAttribute("aria-expanded", "false");
      const workshopAlerts = running.page.getByRole("switch", {
        name: /Workshop needs me/
      });
      const phoneAlerts = running.page.getByRole("switch", {
        name: /Phone activity/
      });
      const residentAlerts = running.page.getByRole("switch", {
        name: /Residents finish answering/
      });
      await expect(workshopAlerts).toHaveCount(0);
      await alertsButton.click();
      await expect(alertsButton).toHaveAttribute("aria-expanded", "true");
      await expect(workshopAlerts).toHaveAttribute("aria-checked", "true");
      await expect(residentAlerts).toHaveAttribute("aria-checked", "true");
      await expect(phoneAlerts).toHaveAttribute("aria-checked", "false");
      await phoneAlerts.click();
      await expect(phoneAlerts).toHaveAttribute("aria-checked", "true");
      await expect
        .poll(() =>
          running.page.evaluate(() =>
            window.hearth.getNotificationStatus()
          )
        )
        .toMatchObject({
          supported: true,
          preferences: {
            workshopAttention: true,
            residentReplies: true,
            phoneActivity: true
          }
        });
      await alertsButton.click();
      await expect(alertsButton).toHaveAttribute("aria-expanded", "false");
      await expect(workshopAlerts).toHaveCount(0);
      await expect(
        running.page.getByRole("switch", { name: /Keep Hearth in the tray/ })
      ).toHaveCount(0);
      await expect(
        running.page.getByRole("button", { name: "Hide now" })
      ).toHaveCount(0);

      await running.app.evaluate(({ BrowserWindow }) => {
        BrowserWindow.getAllWindows()[0]?.close();
      });
      await expect
        .poll(() =>
          running.app.evaluate(({ BrowserWindow }) => {
            const window = BrowserWindow.getAllWindows()[0];
            return {
              count: BrowserWindow.getAllWindows().length,
              visible: window?.isVisible() ?? true,
              destroyed: window?.isDestroyed() ?? true
            };
          })
        )
        .toEqual({ count: 1, visible: false, destroyed: false });
      await running.app.evaluate(({ BrowserWindow }) => {
        const window = BrowserWindow.getAllWindows()[0];
        window?.show();
        window?.focus();
      });
      await expect
        .poll(() =>
          running.app.evaluate(
            ({ BrowserWindow }) =>
              BrowserWindow.getAllWindows()[0]?.isVisible() ?? false
          )
        )
        .toBe(true);
      await running.page
        .getByRole("button", { name: "Turn on locally" })
        .click();

      const status = await running.page.evaluate(() =>
        window.hearth.getCompanionAccess()
      );
      expect(status).toMatchObject({ enabled: true, state: "ready" });
      expect(status.localUrl).toBe(
        process.env.HEARTH_E2E_REAL_TAILSCALE === "1"
          ? "http://127.0.0.1:47831"
          : "http://127.0.0.1:47931"
      );
      expect(status.pairingCode).toMatch(/^\d{6}$/);
      await expect(running.page.locator(".pairing-code")).toHaveText(
        status.pairingCode!
      );

      if (process.env.HEARTH_E2E_REAL_TAILSCALE === "1") {
        const serveStatus = (): Record<string, unknown> =>
          JSON.parse(
            execFileSync(
              "tailscale",
              ["serve", "status", "--json"],
              { encoding: "utf8" }
            )
          ) as Record<string, unknown>;
        const normalHttpsRoute = (value: Record<string, unknown>): string =>
          JSON.stringify({
            TCP: (value.TCP as Record<string, unknown> | undefined)?.["443"],
            Web: Object.fromEntries(
              Object.entries(
                (value.Web as Record<string, unknown> | undefined) ?? {}
              ).filter(([host]) => host.endsWith(":443"))
            )
          });
        const existingHttps = normalHttpsRoute(serveStatus());

        await running.page
          .getByRole("button", { name: "Share privately" })
          .click();
        await expect
          .poll(() =>
            running.page.evaluate(() =>
              window.hearth.getCompanionRemoteAccess()
            )
          )
          .toMatchObject({ state: "active", port: 8443 });
        const privateStatus = await running.page.evaluate(() =>
          window.hearth.getCompanionRemoteAccess()
        );
        const privateResponse = await fetch(
          privateStatus.remoteUrl!
        );
        expect(privateResponse.status).toBe(200);
        expect(await privateResponse.text()).toContain("Pair this screen");

        await running.page
          .getByRole("button", { name: "Stop sharing" })
          .click();
        await expect
          .poll(() =>
            running.page.evaluate(() =>
              window.hearth.getCompanionRemoteAccess()
            )
          )
          .toMatchObject({ state: "available" });
        expect(normalHttpsRoute(serveStatus())).toBe(existingHttps);
      }

      await running.page.screenshot({
        path: path.join(screenshotDirectory, "companion-access-local.png"),
        fullPage: true
      });

      const existingWindows = running.app.windows().length;
      await running.app.evaluate(
        async ({ BrowserWindow }, localUrl) => {
          const mobileWindow = new BrowserWindow({
            width: 390,
            height: 844,
            show: false,
            webPreferences: {
              contextIsolation: true,
              nodeIntegration: false,
              sandbox: true
            }
          });
          await mobileWindow.loadURL(localUrl);
        },
        status.localUrl!
      );
      await expect
        .poll(() => running.app.windows().length)
        .toBe(existingWindows + 1);
      const mobile = running.app.windows().at(-1)!;
      await mobile.setViewportSize({ width: 390, height: 844 });
      await mobile.locator("#code").fill(status.pairingCode!);
      await mobile.getByRole("button", { name: "Pair" }).click();
      await expect(
        mobile.getByRole("heading", { name: "The useful parts of home." })
      ).toBeVisible();
      await expect(mobile.locator("#companion-provider")).toHaveText(
        "Local fallback"
      );
      await mobile.getByLabel("Capture type").selectOption("idea");
      await mobile
        .getByPlaceholder("Paste a link, or use @idea, @note, and #tags…")
        .fill("Try a calmer phone decision inbox.");
      await mobile
        .getByPlaceholder("Paste a link, or use @idea, @note, and #tags…")
        .press("Enter");
      const phoneDecision = mobile
        .locator(".decision")
        .filter({ hasText: "Try a calmer phone decision inbox." });
      await expect(phoneDecision).toBeVisible();
      await phoneDecision.getByRole("button", { name: "Pursue" }).click();
      await expect
        .poll(() =>
          running.page.evaluate(async () => {
            const bootstrap = await window.hearth.bootstrap();
            return bootstrap.captures.find(
              (capture) => capture.text === "Try a calmer phone decision inbox."
            )?.ideaState;
          })
        )
        .toBe("pursuing");
      await expect(
        running.page.getByText("A phone decision was saved.")
      ).toBeVisible();
      for (const width of [320, 390, 430]) {
        await mobile.setViewportSize({ width, height: 844 });
        await expect
          .poll(() =>
            mobile.evaluate(
              () => document.documentElement.scrollWidth <= window.innerWidth
            )
          )
          .toBe(true);
      }
      await mobile.setViewportSize({ width: 390, height: 844 });
      await mobile.screenshot({
        path: path.join(screenshotDirectory, "companion-mobile-viewport.png")
      });
      await mobile.screenshot({
        path: path.join(screenshotDirectory, "companion-mobile-full.png"),
        fullPage: true
      });
      await mobile.getByPlaceholder("Talk it through…").fill(
        "Can you keep this visible while you answer?"
      );
      await mobile.getByPlaceholder("Talk it through…").press("Enter");
      await expect(
        mobile.getByText("Can you keep this visible while you answer?")
      ).toBeVisible();
      await expect(
        mobile.getByRole("button", { name: "Send" })
      ).toBeEnabled();
      await running.page
        .getByRole("button", { name: "Talk to Companion" })
        .click();
      await expect(
        running.page.getByText("Can you keep this visible while you answer?")
      ).toBeVisible();
      await running.page
        .getByRole("button", { name: "Close companion", exact: true })
        .click();

      await running.page.getByRole("button", { name: "New code" }).click();
      const refreshedStatus = await running.page.evaluate(() =>
        window.hearth.getCompanionAccess()
      );
      expect(refreshedStatus.pairingCode).toMatch(/^\d{6}$/);
      const mobileRevoked = await mobile.evaluate(async () =>
        (await fetch("/api/snapshot")).status
      );
      expect(mobileRevoked).toBe(401);

      const unauthorized = await fetch(`${status.localUrl}/api/snapshot`);
      expect(unauthorized.status).toBe(401);
      const paired = await fetch(`${status.localUrl}/pair`, {
        method: "POST",
        body: JSON.stringify({ code: refreshedStatus.pairingCode })
      });
      expect(paired.status).toBe(200);
      const cookie = paired.headers.get("set-cookie")?.split(";")[0];
      expect(cookie).toMatch(/^hearth_companion=/);

      const mobileHome = await fetch(status.localUrl!, {
        headers: { Cookie: cookie! }
      });
      const mobileHtml = await mobileHome.text();
      expect(mobileHtml).toContain("The useful parts of home.");
      expect(mobileHtml).toContain(
        "No terminal, project files, edits, or execution controls live here."
      );

      await running.app.evaluate(({ BrowserWindow }) => {
        BrowserWindow.getAllWindows()[0]?.minimize();
      });
      await expect
        .poll(() =>
          running.app.evaluate(
            ({ BrowserWindow }) =>
              BrowserWindow.getAllWindows()[0]?.isMinimized() ?? false
          )
        )
        .toBe(true);
      const remoteCapture = await fetch(`${status.localUrl}/api/capture`, {
        method: "POST",
        headers: {
          Cookie: cookie!,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          kind: "idea",
          text: "Companion access E2E capture."
        })
      });
      expect(remoteCapture.status).toBe(200);
      expect(
        (
          await running.page.evaluate(() =>
            window.hearth.getNotificationStatus()
          )
        ).preferences.phoneActivity
      ).toBe(true);
      await running.app.evaluate(({ BrowserWindow }) => {
        const window = BrowserWindow.getAllWindows()[0];
        window?.restore();
        window?.focus();
      });
      await expect(
        running.page.getByText("Companion access E2E capture.")
      ).toBeVisible();

      const terminalAttempt = await fetch(`${status.localUrl}/api/terminal`, {
        method: "POST",
        headers: {
          Cookie: cookie!,
          "Content-Type": "application/json"
        },
        body: "{}"
      });
      expect(terminalAttempt.status).toBe(404);
      const approvalAttempt = await fetch(
        `${status.localUrl}/api/proposal/approve`,
        {
          method: "POST",
          headers: {
            Cookie: cookie!,
            "Content-Type": "application/json"
          },
          body: "{}"
        }
      );
      expect(approvalAttempt.status).toBe(404);

      await running.page.getByRole("button", { name: "New code" }).click();
      const revoked = await fetch(`${status.localUrl}/api/snapshot`, {
        headers: { Cookie: cookie! }
      });
      expect(revoked.status).toBe(401);

      await running.page.getByRole("button", { name: "Turn off" }).click();
      await expect(
        running.page.getByRole("button", { name: "Turn on locally" })
      ).toBeVisible();
      expect(
        (await running.page.evaluate(() => window.hearth.getCompanionAccess()))
          .enabled
      ).toBe(false);
    } finally {
      await running.app.close();
    }
  });

  test("persists the project across room navigation, renderer reload, leaving, and relaunch", async () => {
    let running = await launch();

    await expect(running.page.getByRole("heading", { name: "Welcome home." })).toBeVisible();
    await expect(running.page.getByText("No blockers · no live processes")).toBeVisible();

    const capture = running.page.getByLabel("Save a link, thought, or idea");
    await capture.fill("https://github.com/microsoft/terminal");
    await capture.press("Enter");
    await expect(running.page.getByText("Link kept for the Library.")).toBeVisible();

    await running.page.getByLabel("Rooms").getByRole("button", { name: /Library/ }).click();
    await expect(
      running.page.getByRole("heading", { name: "A useful shelf, not a link graveyard." })
    ).toBeVisible();
    const raisedDesk = await running.page.evaluate(() => {
      const portrait = document.querySelector<HTMLElement>(
        ".librarian-rail > header .avatar"
      );
      const rail = document.querySelector<HTMLElement>(".librarian-rail");
      const catalog = document.querySelector<HTMLElement>(".library-catalog");
      return {
        portraitWidth: portrait?.getBoundingClientRect().width ?? 0,
        railTop: rail?.getBoundingClientRect().top ?? 0,
        catalogTop: catalog?.getBoundingClientRect().top ?? 0
      };
    });
    expect(raisedDesk.portraitWidth).toBeGreaterThanOrEqual(87);
    expect(raisedDesk.railTop).toBeLessThan(raisedDesk.catalogTop);
    const libraryItem = running.page.locator(".library-item").filter({ hasText: "github.com" });
    await expect(libraryItem).toBeVisible();
    await running.page.getByLabel("Search Library").fill("microsoft");
    await expect(libraryItem).toBeVisible();
    await libraryItem.getByRole("button", { name: "Edit" }).click();
    await libraryItem.getByLabel("Name").fill("Windows Terminal");
    await libraryItem.getByLabel("Tags").fill("terminal, windows, reference");
    await libraryItem.getByRole("button", { name: "Save", exact: true }).click();
    await expect(libraryItem.getByRole("heading", { name: "Windows Terminal" })).toBeVisible();
    await libraryItem.getByRole("button", { name: "Pin" }).click();
    await expect(libraryItem.getByText(/Pinned · github\.com/)).toBeVisible();
    await libraryItem.getByRole("button", { name: "Discuss" }).click();
    await expect(running.page.locator(".librarian-item-context")).toContainText(
      "Windows Terminal"
    );
    await running.page
      .getByRole("button", { name: "Stop discussing this Library item" })
      .click();
    await running.page.getByLabel("Sort Library").selectOption("title");
    await expect(running.page.locator(".library-catalog-status")).toContainText(
      "1 of 1 shown"
    );
    const librarianComposer = running.page.getByLabel("Ask Librarian");
    await librarianComposer.fill("Find the terminal link I saved.");
    await librarianComposer.press("Shift+Enter");
    await librarianComposer.pressSequentially("Keep it brief.");
    await expect(librarianComposer).toHaveValue(
      "Find the terminal link I saved.\nKeep it brief."
    );
    await librarianComposer.press("Enter");
    await expect(running.page.getByText(/likely match/i)).toBeVisible();
    const librarianType = await running.page
      .locator(".librarian-messages article")
      .last()
      .evaluate((message) => ({
        message: Number.parseFloat(
          getComputedStyle(message.querySelector("p")!).fontSize
        ),
        speaker: Number.parseFloat(
          getComputedStyle(message.querySelector("strong")!).fontSize
        )
      }));
    expect(librarianType.message).toBeGreaterThanOrEqual(11);
    expect(librarianType.speaker).toBeGreaterThanOrEqual(9);
    await librarianComposer.fill("Doing ok this afternoon?");
    await librarianComposer.press("Enter");
    const socialReply = running.page.locator(".librarian-messages article").last();
    await expect(socialReply).toContainText("Yeah, I’m doing okay. How are you?");
    await expect(socialReply).not.toContainText(/discovery|terminal|correction/i);
    const librarianMessages = running.page.locator(".librarian-messages");
    await librarianMessages.evaluate((element) => {
      element.style.height = "120px";
      element.scrollTop = 0;
    });
    await librarianComposer.fill("Hello");
    await librarianComposer.press("Enter");
    await expect(
      librarianMessages.locator("article").filter({ hasText: "Hello" })
    ).toBeVisible();
    await expect
      .poll(() =>
        librarianMessages.evaluate(
          (element) =>
            element.scrollTop + element.clientHeight >= element.scrollHeight - 1
        )
      )
      .toBe(true);
    await expect(running.page.getByRole("button", { name: "Ask", exact: true })).toBeVisible();
    await librarianMessages.evaluate((element) => {
      element.style.height = "";
    });
    await running.page.getByLabel("Search Library").fill("");
    await running.page.getByRole("button", { name: /Discover/ }).click();
    await expect(running.page.getByRole("button", { name: /Refresh shelf/ })).toBeVisible();
    await expect(running.page.getByRole("button", { name: "Dependable" })).toBeVisible();
    await expect(running.page.getByRole("button", { name: "Emerging" })).toBeVisible();
    await expect(running.page.getByRole("button", { name: "Skills" })).toBeVisible();
    await expect(running.page.locator(".library-discovery-status")).toContainText(
      /Current shelf|Last good shelf/
    );
    await expect(running.page.locator(".library-discovery-status")).toContainText(
      "shaped by Hearth and what you keep"
    );
    expect(
      await running.page.locator(".library-discovery-status").evaluate(
        (element) => Number.parseFloat(getComputedStyle(element).fontSize)
      )
    ).toBeGreaterThanOrEqual(11);
    await expect(running.page.locator(".librarian-provider")).toHaveText("Hearth local");
    const discoveryCard = running.page.locator(".library-discovery-item").first();
    const discoveryVisible = await discoveryCard
      .waitFor({ state: "visible", timeout: 8_000 })
      .then(() => true)
      .catch(() => false);
    if (discoveryVisible) {
      const discoveryType = await discoveryCard.evaluate((card) => {
        const description = card.querySelector<HTMLElement>(".library-item-copy");
        const reason = card.querySelector<HTMLElement>(".library-discovery-reason");
        return {
          description: Number.parseFloat(
            description ? getComputedStyle(description).fontSize : "0"
          ),
          reason: Number.parseFloat(reason ? getComputedStyle(reason).fontSize : "0")
        };
      });
      expect(discoveryType.description).toBeGreaterThanOrEqual(11);
      expect(discoveryType.reason).toBeGreaterThanOrEqual(10);
      await running.page.screenshot({
        path: path.join(screenshotDirectory, "library-discovery.png"),
        fullPage: true
      });
      const discoveryName =
        (await discoveryCard.getByRole("heading").textContent())?.trim() ?? "";
      await discoveryCard.getByRole("button", { name: "Not for me" }).click();
      await running.page.getByRole("button", { name: "Hidden" }).click();
      const hiddenCard = running.page
        .locator(".library-discovery-item")
        .filter({ hasText: discoveryName });
      await expect(hiddenCard).toBeVisible();
      await hiddenCard.getByRole("button", { name: "Put back" }).click();
      await expect(hiddenCard).not.toBeVisible();
      await running.page.getByRole("button", { name: "Curated" }).click();
      await expect(
        running.page.locator(".library-discovery-item").filter({ hasText: discoveryName })
      ).toBeVisible();
    }
    await running.page.getByRole("button", { name: "Your collection" }).click();
    await running.app.evaluate(({ BrowserWindow }) => {
      BrowserWindow.getAllWindows()[0]?.setSize(1080, 720);
    });
    await running.page.waitForTimeout(300);
    const libraryBounds = await running.page.evaluate(() => {
      const catalog = document.querySelector<HTMLElement>(".library-catalog");
      return {
        documentWidth: document.documentElement.clientWidth,
        documentScrollWidth: document.documentElement.scrollWidth,
        catalogWidth: catalog?.clientWidth ?? 0,
        catalogScrollWidth: catalog?.scrollWidth ?? 0,
        roomHeight: document.querySelector<HTMLElement>(".library-room")?.clientHeight ?? 0,
        roomScrollHeight:
          document.querySelector<HTMLElement>(".library-room")?.scrollHeight ?? 0
      };
    });
    expect(libraryBounds.documentScrollWidth).toBeLessThanOrEqual(libraryBounds.documentWidth + 1);
    expect(libraryBounds.catalogScrollWidth).toBeLessThanOrEqual(libraryBounds.catalogWidth + 1);
    expect(libraryBounds.roomScrollHeight).toBeLessThanOrEqual(libraryBounds.roomHeight + 1);
    await running.page.screenshot({
      path: path.join(screenshotDirectory, "library-compact.png"),
      fullPage: true
    });
    await running.app.evaluate(({ BrowserWindow }) => {
      BrowserWindow.getAllWindows()[0]?.setSize(1440, 900);
    });
    await running.page.waitForTimeout(300);
    await running.page.screenshot({
      path: path.join(screenshotDirectory, "library.png"),
      fullPage: true
    });

    await running.page.getByLabel("Rooms").getByRole("button", { name: /Study/ }).click();
    await running.page.getByRole("tab", { name: "Brief & Maker" }).click();
    await expect(running.page.getByRole("heading", { name: "Talk through the work" })).toBeVisible();

    const objective = "Prove that Hearth can reload, leave, and relaunch without losing the thread.";
    await running.page.getByRole("button", { name: "Clarify objective" }).click();
    await running.page.locator(".objective-editor textarea").fill(objective);
    await running.page.getByRole("button", { name: "Save objective" }).click();
    await expect(running.page.getByText(objective)).toBeVisible();

    const makerMessage = "Explain why the real terminal comes after this continuity test.";
    const studyMakerComposer = running.page.getByLabel("Message Maker");
    await studyMakerComposer.fill(makerMessage);
    await studyMakerComposer.press("Shift+Enter");
    await studyMakerComposer.pressSequentially("Be concise.");
    await expect(studyMakerComposer).toHaveValue(`${makerMessage}\nBe concise.`);
    await studyMakerComposer.press("Enter");
    await expect(running.page.getByText(/terminal is real/i)).toBeVisible();
    await running.page.screenshot({
      path: path.join(screenshotDirectory, "study.png"),
      fullPage: true
    });

    await running.page.reload();
    await running.page.getByRole("tab", { name: "Brief & Maker" }).click();
    await expect(running.page.getByRole("heading", { name: "Talk through the work" })).toBeVisible();
    await expect(running.page.getByText(makerMessage)).toBeVisible();
    await expect(running.page.getByText(objective)).toBeVisible();

    await running.page.getByRole("button", { name: "Leave well" }).click();
    await running.page
      .getByLabel("Optional note")
      .fill("We proved the Study conversation survives a renderer reload.");
    await running.page.getByRole("button", { name: "Create Return Pack" }).click();

    await expect(running.page.getByRole("heading", { name: "Welcome home." })).toBeVisible();
    await expect(
      running.page.getByText("We proved the Study conversation survives a renderer reload.")
    ).toBeVisible();
    await running.page.screenshot({
      path: path.join(screenshotDirectory, "home-return.png"),
      fullPage: true
    });

    await running.app.evaluate(({ BrowserWindow }) => {
      BrowserWindow.getAllWindows()[0]?.setSize(1080, 720);
    });
    await running.page.waitForTimeout(180);
    const furnishedHomeBounds = await running.page.evaluate(() => ({
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: document.documentElement.clientWidth,
      roomWidth: document.querySelector(".home-room")?.scrollWidth ?? 0,
      roomViewportWidth: document.querySelector(".home-room")?.clientWidth ?? 0
    }));
    expect(furnishedHomeBounds.documentWidth).toBe(furnishedHomeBounds.viewportWidth);
    expect(furnishedHomeBounds.roomWidth).toBe(furnishedHomeBounds.roomViewportWidth);
    await running.page.screenshot({
      path: path.join(screenshotDirectory, "home-furnished-1080.png"),
      fullPage: true
    });

    await running.app.close();
    running = await launch();

    await expect(running.page.getByRole("heading", { name: "Welcome home." })).toBeVisible();
    await expect(
      running.page.getByText("We proved the Study conversation survives a renderer reload.")
    ).toBeVisible();
    await expect(running.page.getByText("https://github.com/microsoft/terminal")).toBeVisible();
    await running.app.close();
  });

  test("allows free conversation with Companion from Home", async () => {
    const running = await launch();
    const companionButton = running.page.getByRole("button", {
      name: "Talk to Companion"
    });
    const companionCharacter = companionButton.locator(".companion-character");
    await expect(companionCharacter).toHaveAttribute("data-mood", "idle");
    await expect(companionCharacter.locator(".companion-eyes > i")).toHaveCount(2);
    await expect(companionCharacter.locator(".companion-mouth")).toHaveCount(1);
    await running.page.screenshot({
      path: path.join(screenshotDirectory, "companion-character-idle.png"),
      fullPage: true
    });
    await companionButton.click();
    await expect(
      running.page.getByRole("heading", { name: "Companion", exact: true })
    ).toBeVisible();
    await expect(
      running.page.locator(".companion-button .companion-character")
    ).toHaveAttribute("data-mood", "listening");
    await expect(
      running.page.locator(".companion-heading .companion-character")
    ).toHaveAttribute("data-mood", "listening");
    await running.page.screenshot({
      path: path.join(screenshotDirectory, "companion-character-open.png"),
      fullPage: true
    });
    const companionComposer = running.page.getByLabel("Message Companion");
    await companionComposer.fill("Where did I leave off?");
    await companionComposer.press("Shift+Enter");
    await companionComposer.pressSequentially("Just the next step.");
    await expect(companionComposer).toHaveValue(
      "Where did I leave off?\nJust the next step."
    );
    await companionComposer.press("Enter");
    await expect(running.page.getByText(/left off in Workshop/i)).toBeVisible();
    await running.app.close();
  });

  test("supports persistent shared Living Room conversations, roundtables, and pressure tests", async () => {
    let running = await launch();
    try {
      await running.page
        .getByLabel("Rooms")
        .getByRole("button", { name: /Home/ })
        .click();
      await running.page.getByRole("button", { name: "Gather everyone" }).click();
      await expect(
        running.page.getByRole("heading", { name: "Pull up a chair." })
      ).toBeVisible();
      const contextCard = running.page.locator(".living-context-card");
      await expect(contextCard).toContainText("Home · household check-in");
      await expect(contextCard).toContainText("Private chats and terminal output stay out");
      await running.page.getByRole("button", { name: /Conversation/ }).click();
      const composer = running.page.getByLabel("Talk to the room");
      await expect(composer).toBeEnabled();

      await composer.fill("Should we keep the first move small?");
      await composer.press("Enter");
      await expect(
        running.page.getByText("Should we keep the first move small?")
      ).toBeVisible();
      await expect(
        running.page.getByText(/with the smaller test/i)
      ).toBeVisible();

      await running.page.getByRole("button", { name: /Roundtable/ }).click();
      await expect(
        running.page.locator(".living-composer footer strong")
      ).toContainText("Maker");
      await expect(
        running.page.locator(".living-composer footer strong")
      ).toContainText("Critic");
      await composer.fill("What is the actual risk here?");
      await composer.press("Enter");
      await expect(
        running.page.getByText(/keep the next move small and concrete/i)
      ).toBeVisible();
      await expect(
        running.page.getByText(/push on is the proof/i)
      ).toBeVisible();

      await running.page.getByRole("button", { name: /Pressure test/ }).click();
      const household = running.page.locator(".living-household");
      await household
        .locator(".living-resident")
        .filter({ hasText: "Librarian" })
        .click();
      await expect(
        running.page.locator(".living-composer footer strong")
      ).toContainText("Maker → Critic → Librarian → Companion");
      await composer.fill("Pressure-test whether this deserves another week.");
      await composer.press("Enter");
      await expect(
        running.page.getByText(/Building the whole thing first/i)
      ).toBeVisible();
      await expect(
        running.page.getByText(/supporting context here, not the decision-maker/i)
      ).toBeVisible();
      await expect(
        running.page.getByText(/The useful split is pretty clear/i)
      ).toBeVisible();

      await running.page.getByRole("button", { name: "Rename" }).click();
      const titleEditor = running.page.getByLabel("Discussion title");
      await titleEditor.fill("Risk review");
      await titleEditor.press("Enter");
      await expect(
        running.page.getByRole("heading", { name: "Risk review" })
      ).toBeVisible();
      const discussionSearch = running.page.getByPlaceholder("Search discussions…");
      await discussionSearch.fill("Risk review");
      await expect(
        running.page.locator(".living-thread-strip").getByText("Risk review")
      ).toBeVisible();
      await discussionSearch.fill("");

      await running.page.getByRole("button", { name: "Put away", exact: true }).click();
      await running.page.getByRole("button", { name: "Put away", exact: true }).click();
      await running.page.getByRole("button", { name: /Put away · 1/ }).click();
      await expect(
        running.page.getByText("This discussion is put away. Bring it back before continuing it.")
      ).toBeVisible();
      await running.page.getByRole("button", { name: "Bring back" }).click();
      await expect(
        running.page.getByRole("heading", { name: "Risk review" })
      ).toBeVisible();

      await running.page.getByRole("button", { name: "Draft for Maker" }).click();
      await expect(
        running.page.getByRole("heading", { name: "Hearth", exact: true })
      ).toBeVisible();
      await expect(running.page.getByLabel("Message Maker")).toHaveValue(
        /Living Room decision · Risk review/
      );
      await running.page
        .getByLabel("Rooms")
        .getByRole("button", { name: /Living Room/ })
        .click();

      await running.app.evaluate(({ BrowserWindow }) => {
        BrowserWindow.getAllWindows()[0]?.setSize(1080, 720);
      });
      await running.page.waitForTimeout(250);
      const compact = await running.page.evaluate(() => {
        const room = document.querySelector<HTMLElement>(".living-room");
        const conversation = document.querySelector<HTMLElement>(
          ".living-conversation"
        );
        return {
          viewportWidth: document.documentElement.clientWidth,
          documentWidth: document.documentElement.scrollWidth,
          roomHeight: room?.clientHeight ?? 0,
          roomScrollHeight: room?.scrollHeight ?? 0,
          conversationWidth: conversation?.clientWidth ?? 0,
          conversationScrollWidth: conversation?.scrollWidth ?? 0
        };
      });
      expect(compact.documentWidth).toBeLessThanOrEqual(compact.viewportWidth + 1);
      expect(compact.roomScrollHeight).toBeLessThanOrEqual(compact.roomHeight + 1);
      expect(compact.conversationScrollWidth).toBeLessThanOrEqual(
        compact.conversationWidth + 1
      );
      await running.page.screenshot({
        path: path.join(screenshotDirectory, "living-room-compact.png"),
        fullPage: true
      });
      await running.app.evaluate(({ BrowserWindow }) => {
        BrowserWindow.getAllWindows()[0]?.setSize(1440, 900);
      });
      await running.page.waitForTimeout(250);
      await running.page.screenshot({
        path: path.join(screenshotDirectory, "living-room.png"),
        fullPage: true
      });
    } finally {
      await running.app.close();
    }

    running = await launch();
    try {
      await running.page
        .getByLabel("Rooms")
        .getByRole("button", { name: /Living Room/ })
        .click();
      await expect(
        running.page.getByText("Pressure-test whether this deserves another week.")
      ).toBeVisible();
      await expect(
        running.page.getByText(/The useful split is pretty clear/i)
      ).toBeVisible();
    } finally {
      await running.app.close();
    }
  });

  test("routes ideas, notes, and links to one canonical home and finds them everywhere", async () => {
    const running = await launch();
    try {
      await running.page.getByLabel("Rooms").getByRole("button", { name: /Home/ }).click();
      const capture = running.page.getByLabel("Save a link, thought, or idea");
      const ideaText = "Sketch a voice-first project review flow.";
      const noteText = "Keep the resize review aligned with the terminal.";
      const projectNoteText = "Check the mobile decision surface after the next desktop pass.";
      const linkUrl = "https://github.com/microsoft/terminal/issues/123?utm_source=hearth";

      await capture.fill(`@idea ${ideaText} #voice #review`);
      await capture.press("Enter");
      await expect(running.page.getByText("Idea is resting in Studio.")).toBeVisible();

      await capture.fill(`@note @"Review Project" ${noteText} #ui`);
      await capture.press("Enter");
      await expect(
        running.page.getByText("Note connected to Review Project.")
      ).toBeVisible();

      await capture.fill(
        `${linkUrl} @Review_Project #workflow A useful reference for the review.`
      );
      await capture.press("Enter");
      await expect(running.page.getByText("Link kept for the Library.")).toBeVisible();

      await running.page.getByLabel("Rooms").getByRole("button", { name: /Library/ }).click();
      const stacksButton = running.page.getByRole("button", {
        name: /PersonalOS Stacks 2 new/
      });
      await expect(stacksButton).toBeVisible();
      await stacksButton.click();
      await expect(
        running.page.getByRole("heading", { name: "Bring over PersonalOS Stacks" })
      ).toBeVisible();
      await expect(running.page.getByText("A saved design field guide")).toBeVisible();
      await expect(running.page.getByText("stacks-released")).toHaveCount(0);
      await running.page.screenshot({
        path: path.join(screenshotDirectory, "personalos-stacks-review.png"),
        fullPage: true
      });
      await running.page.getByRole("button", { name: "Bring over 2" }).click();
      await expect(
        running.page.getByText("2 links brought over from PersonalOS Stacks.")
      ).toBeVisible();
      await expect(
        running.page.getByRole("button", { name: /PersonalOS Stacks Current/ })
      ).toBeVisible();
      const importedStack = running.page
        .locator(".library-item")
        .filter({ hasText: "A saved design field guide" });
      await expect(importedStack).toBeVisible();
      await expect(importedStack).toContainText("design-skills");
      await expect(importedStack).toContainText("Design Skills");
      await expect(
        running.page.locator(".library-item").filter({ hasText: "stacks-released" })
      ).toHaveCount(0);
      await expect
        .poll(async () => {
          const preview = await running.page.evaluate(() =>
            window.hearth.inspectPersonalOsStacks()
          );
          return preview.newCount;
        })
        .toBe(0);
      const routedLink = running.page
        .locator(".library-item")
        .filter({ hasText: "A useful reference for the review." });
      await expect(routedLink).toBeVisible();
      await expect(routedLink).toContainText("workflow");
      await expect(routedLink).toContainText("Review Project");
      await expect(routedLink).toContainText("Unfiled");
      await expect(routedLink.locator(".reference-card")).toContainText("Issue");
      await expect(routedLink.locator(".reference-card")).toContainText(
        "https://github.com/microsoft/terminal/issues/123"
      );
      await expect(routedLink.locator(".reference-card")).not.toContainText("utm_source");
      await routedLink.getByRole("button", { name: "Edit" }).click();
      await routedLink.getByLabel("Collection").fill("Workflow");
      await routedLink.getByRole("button", { name: "Save" }).click();
      await expect(routedLink).toContainText("Workflow");
      const collectionShelf = running.page.getByLabel("Library collections");
      await collectionShelf
        .getByRole("button", { name: /Design Skills 1/ })
        .click();
      await expect(importedStack).toBeVisible();
      await expect(routedLink).toHaveCount(0);
      await running.page.screenshot({
        path: path.join(screenshotDirectory, "library-collections.png"),
        fullPage: true
      });
      await collectionShelf.getByRole("button", { name: "All" }).click();
      await expect(routedLink).toBeVisible();
      await expect(running.page.locator(".library-item").filter({ hasText: ideaText })).toHaveCount(0);
      await expect(running.page.locator(".library-item").filter({ hasText: noteText })).toHaveCount(0);

      await running.page.getByLabel("Rooms").getByRole("button", { name: /Studio/ }).click();
      await expect(running.page.locator(".studio-idea").filter({ hasText: ideaText })).toBeVisible();
      await running.page.getByRole("tab", { name: /^Notes/ }).click();
      const connectedNote = running.page.locator(".studio-note-card").filter({ hasText: noteText });
      await expect(connectedNote).toBeVisible();
      await expect(connectedNote).toContainText("Review Project");
      await expect(connectedNote).toContainText("ui");
      await running.page.screenshot({
        path: path.join(screenshotDirectory, "canonical-studio-notes.png"),
        fullPage: true
      });

      await running.page.getByRole("button", { name: "Search Hearth" }).click();
      await running.page
        .getByRole("textbox", { name: "Search the house" })
        .fill("voice review");
      const ideaResult = running.page.locator(".hearth-search-result").filter({ hasText: ideaText });
      await expect(ideaResult).toBeVisible();
      await running.page.screenshot({
        path: path.join(screenshotDirectory, "whole-house-search.png"),
        fullPage: true
      });
      await ideaResult.click();
      await expect(running.page.locator(".studio-idea.is-focused").filter({ hasText: ideaText })).toBeVisible();

      await running.page.getByRole("button", { name: "Search Hearth" }).click();
      await running.page.getByRole("tab", { name: "Notes", exact: true }).click();
      await running.page
        .getByRole("textbox", { name: "Search the house" })
        .fill("resize ui");
      const noteResult = running.page.locator(".hearth-search-result").filter({ hasText: noteText });
      await expect(noteResult).toBeVisible();
      await noteResult.click();
      await expect(running.page.locator(".studio-note-card.is-focused").filter({ hasText: noteText })).toBeVisible();

      await running.page.getByLabel("Rooms").getByRole("button", { name: /Study/ }).click();
      await running.page.getByRole("tab", { name: "Project room" }).click();
      await running.page.locator(".project-list-item").filter({ hasText: "Review Project" }).click();
      await running.page.getByRole("button", { name: /^Notes/ }).click();
      await expect(running.page.locator(".project-note-card").filter({ hasText: noteText })).toBeVisible();
      await expect(running.page.locator(".project-reference-card")).toContainText(
        "microsoft/terminal"
      );
      const projectNote = running.page.getByPlaceholder(/Remember something about Review Project/);
      await projectNote.fill(projectNoteText);
      await running.page.getByRole("button", { name: "Keep note" }).click();
      const projectNoteCard = running.page
        .locator(".project-note-card")
        .filter({ hasText: projectNoteText });
      await expect(projectNoteCard).toBeVisible();

      await running.page.setViewportSize({ width: 1080, height: 720 });
      await expect
        .poll(() =>
          running.page.evaluate(
            () => document.documentElement.scrollWidth <= window.innerWidth
          )
        )
        .toBe(true);
      await running.page.screenshot({
        path: path.join(screenshotDirectory, "canonical-project-notes-1080.png"),
        fullPage: true
      });
      await running.page.setViewportSize({ width: 1440, height: 900 });
      await running.page.screenshot({
        path: path.join(screenshotDirectory, "canonical-project-notes.png"),
        fullPage: true
      });
      await projectNoteCard
        .getByRole("button", { name: "Remove from project" })
        .click();
      await expect(projectNoteCard).toHaveCount(0);
      await expect(running.page.getByText("Note moved to Loose Notes.")).toBeVisible();
      await running.page.getByLabel("Rooms").getByRole("button", { name: /Studio/ }).click();
      await running.page.getByRole("tab", { name: /^Notes/ }).click();
      await running.page
        .getByLabel("Note location")
        .getByRole("tab", { name: "Loose" })
        .click();
      await expect(
        running.page.locator(".studio-note-card").filter({ hasText: projectNoteText })
      ).toBeVisible();
    } finally {
      await running.app.close();
    }
  });

  test("lets ideas rest, be pursued, be let go, and return in Studio", async () => {
    const running = await launch();
    try {
      await running.page
        .getByLabel("Rooms")
        .getByRole("button", { name: /Studio/ })
        .click();
      await expect(
        running.page.getByRole("heading", {
          name: "Let an idea rest before it asks anything of you."
        })
      ).toBeVisible();

      const ideaText = "Build a calm visual diff room for reviewing agent work.";
      const composer = running.page.getByLabel("New idea");
      await composer.fill(ideaText);
      await composer.press("Enter");
      const ideaCard = running.page.locator(".studio-idea").filter({ hasText: ideaText });
      await expect(ideaCard).toBeVisible();
      await expect(ideaCard.getByText("Resting", { exact: true })).toBeVisible();

      await ideaCard.getByRole("button", { name: "Pursue" }).click();
      await running.page.getByRole("tab", { name: "Pursuing" }).click();
      await expect(ideaCard).toBeVisible();
      await expect(ideaCard.getByText("Pursuing", { exact: true })).toBeVisible();

      await running.page.reload();
      await expect(
        running.page.getByRole("heading", {
          name: "Let an idea rest before it asks anything of you."
        })
      ).toBeVisible();
      await running.page.getByRole("tab", { name: "Pursuing" }).click();
      const restoredCard = running.page.locator(".studio-idea").filter({ hasText: ideaText });
      await expect(restoredCard).toBeVisible();
      await restoredCard.getByRole("button", { name: "Let go" }).click();
      await running.page.getByRole("tab", { name: "Let go" }).click();
      await expect(restoredCard).toBeVisible();

      await running.page.getByLabel("Rooms").getByRole("button", { name: /Library/ }).click();
      await expect(running.page.locator(".library-item").filter({ hasText: ideaText })).toHaveCount(0);
      await running.page
        .getByLabel("Library shelves")
        .getByRole("button", { name: "Put away" })
        .click();
      await expect(running.page.locator(".library-item").filter({ hasText: ideaText })).toHaveCount(0);

      await running.page.getByLabel("Rooms").getByRole("button", { name: /Studio/ }).click();
      await running.page.getByRole("tab", { name: "Let go" }).click();
      await restoredCard.getByRole("button", { name: "Bring back" }).click();
      await running.page.getByRole("tab", { name: "Resting" }).click();
      await expect(restoredCard).toBeVisible();

      await restoredCard.getByRole("button", { name: "Pursue" }).click();
      await running.page.getByRole("tab", { name: "Pursuing" }).click();
      await restoredCard.getByRole("button", { name: "Talk with Maker" }).click();
      const studioMaker = running.page.getByLabel("Talk with Maker");
      await studioMaker.fill("What is the smallest useful version of this?");
      await studioMaker.press("Enter");
      await expect(
        running.page.getByText(/I think this has legs/i)
      ).toBeVisible();
      await running.page.screenshot({
        path: path.join(screenshotDirectory, "studio-development.png")
      });
      await running.page.getByRole("tab", { name: "Make it a project" }).click();
      await running.page.getByRole("button", { name: "New project" }).click();
      await expect(running.page.getByText(/Hearth Projects/)).toBeVisible();
      await expect(running.page.getByLabel("Project name")).not.toHaveValue(/\.$/);
      await running.page.screenshot({
        path: path.join(screenshotDirectory, "studio-new-project.png")
      });
      await running.page.getByRole("button", { name: "Existing project" }).click();
      const projectSelect = running.page.getByLabel("Connect to");
      const reviewOption = projectSelect.locator("option").filter({
        hasText: "Review Project"
      });
      await projectSelect.selectOption(await reviewOption.getAttribute("value") ?? "");
      await running.page.screenshot({
        path: path.join(screenshotDirectory, "studio-promotion.png")
      });
      await running.page.getByRole("button", { name: "Connect idea" }).click();
      await expect(
        running.page.getByRole("heading", { name: "Review Project" })
      ).toBeVisible();
      await running.page.getByRole("button", { name: "Stay in Studio" }).click();
      await expect(restoredCard.getByText("Project · Review Project")).toBeVisible();

      await restoredCard.getByRole("button", { name: "Talk with Maker" }).click();
      await expect(
        running.page.getByText("What is the smallest useful version of this?")
      ).toBeVisible();
      await running.page.getByLabel("Close idea").click();
      await running.page.screenshot({
        path: path.join(screenshotDirectory, "studio-wide.png"),
        fullPage: true
      });

      await running.app.evaluate(({ BrowserWindow }) => {
        BrowserWindow.getAllWindows()[0]?.setSize(1040, 700);
      });
      await expect
        .poll(() =>
          running.page.evaluate(
            () =>
              document.documentElement.scrollWidth <=
              document.documentElement.clientWidth + 1
          )
        )
        .toBe(true);
      await running.page.screenshot({
        path: path.join(screenshotDirectory, "studio-compact.png"),
        fullPage: true
      });
    } finally {
      await running.app.close();
    }
  });

  test("discovers, browses, reviews, and opens a project in Workshop", async () => {
    const running = await launch();
    try {
      await running.page
        .getByLabel("Rooms")
        .getByRole("button", { name: /Study/ })
        .click();
      await expect(running.page.getByRole("heading", { name: "Projects" })).toBeVisible();
      await expect(running.page.getByText(/discovered/).first()).toBeVisible();

      await running.page
        .locator(".project-list")
        .getByRole("button", { name: /Review Project/ })
        .click();
      await expect(
        running.page.locator(".project-title").getByRole("heading", {
          name: "Review Project"
        })
      ).toBeVisible();
      await expect(
        running.page.locator(".project-inspector")
      ).toContainText("A real project fixture for Hearth's calm review surface.");

      await running.page
        .locator(".directory-list")
        .getByRole("button", { name: /src/ })
        .click();
      await running.page
        .locator(".directory-list")
        .getByRole("button", { name: /app\.ts/ })
        .click();
      await expect(running.page.locator(".file-view")).toContainText(
        "Welcome home, ${name} · café Ω 漢字 🚀"
      );
      await running.page.screenshot({
        path: path.join(screenshotDirectory, "projects-files.png"),
        fullPage: true
      });

      if (await clipboardAvailable(running.page)) {
        await running.page.getByRole("button", { name: "Copy file" }).click();
        await expect
          .poll(() => running.page.evaluate(() => window.hearth.readClipboard()))
          .toContain("café Ω 漢字 🚀");
      }

      await running.page.getByRole("button", { name: "Edit file" }).click();
      const fileEditor = running.page.getByLabel("File contents");
      const originalFile = await fileEditor.inputValue();
      await fileEditor.fill(originalFile.replace("Welcome home", "Welcome back"));
      await running.page.getByRole("button", { name: "Review changes" }).click();
      await expect(
        running.page.getByText(/Apply will stop if the file changes/i)
      ).toBeVisible();
      await expect(running.page.locator(".project-edit-line--added")).toContainText(
        "Welcome back"
      );
      await running.page.screenshot({
        path: path.join(screenshotDirectory, "project-edit-review.png"),
        fullPage: true
      });
      await running.app.evaluate(({ BrowserWindow }) => {
        BrowserWindow.getAllWindows()[0]?.setSize(1040, 700);
      });
      await running.page.waitForTimeout(300);
      const editBounds = await running.page.evaluate(() => {
        const dialog = document.querySelector<HTMLElement>(".project-edit-dialog");
        const diff = document.querySelector<HTMLElement>(".project-edit-diff");
        return {
          documentWidth: document.documentElement.clientWidth,
          documentScrollWidth: document.documentElement.scrollWidth,
          dialogWidth: dialog?.clientWidth ?? 0,
          dialogScrollWidth: dialog?.scrollWidth ?? 0,
          diffHeight: diff?.clientHeight ?? 0
        };
      });
      expect(editBounds.documentScrollWidth).toBeLessThanOrEqual(
        editBounds.documentWidth + 1
      );
      expect(editBounds.dialogScrollWidth).toBeLessThanOrEqual(
        editBounds.dialogWidth + 1
      );
      expect(editBounds.diffHeight).toBeGreaterThan(120);
      await running.page.screenshot({
        path: path.join(screenshotDirectory, "project-edit-review-compact.png"),
        fullPage: true
      });
      await running.app.evaluate(({ BrowserWindow }) => {
        BrowserWindow.getAllWindows()[0]?.setSize(1440, 900);
      });
      await running.page.waitForTimeout(300);
      await running.page.getByRole("button", { name: "Apply this edit" }).click();
      await expect(
        running.page.getByRole("heading", { name: "The reviewed edit is on disk." })
      ).toBeVisible();
      await running.page
        .getByRole("dialog")
        .getByRole("button", { name: "Undo this edit" })
        .click();
      await expect(
        running.page.getByRole("heading", { name: "The previous file is back." })
      ).toBeVisible();
      await running.page
        .getByRole("dialog")
        .getByRole("button", { name: "Done" })
        .click();
      await expect(running.page.getByRole("dialog")).toBeHidden();
      await expect(running.page.locator(".file-view")).toContainText(
        "Welcome home, ${name}"
      );

      await running.page.getByRole("button", { name: "Ask Maker" }).click();
      await running.page
        .getByLabel("Change request")
        .fill('Replace "Welcome home" with "Welcome back".');
      await running.page.getByRole("button", { name: "Draft this change" }).click();
      await expect(
        running.page.locator(".project-edit-resident--maker")
      ).toContainText("Welcome home");
      await expect(running.page.locator(".project-edit-line--added")).toContainText(
        "Welcome back"
      );
      expect(await readFile(path.join(reviewProject, "src", "app.ts"), "utf8")).toContain(
        "Welcome home"
      );
      await running.page
        .getByRole("button", { name: "Ask Critic to review" })
        .click();
      await expect(
        running.page.locator(".project-edit-resident--critic")
      ).toContainText("Proceed with caution");
      await running.page.screenshot({
        path: path.join(screenshotDirectory, "resident-project-edit-review.png"),
        fullPage: true
      });
      await running.app.evaluate(({ BrowserWindow }) => {
        BrowserWindow.getAllWindows()[0]?.setSize(1040, 700);
      });
      await running.page.waitForTimeout(300);
      const residentEditBounds = await running.page.evaluate(() => {
        const dialog = document.querySelector<HTMLElement>(".project-edit-dialog");
        const residentRow = document.querySelector<HTMLElement>(
          ".project-edit-resident-row"
        );
        const diff = document.querySelector<HTMLElement>(".project-edit-diff");
        return {
          documentWidth: document.documentElement.clientWidth,
          documentScrollWidth: document.documentElement.scrollWidth,
          dialogWidth: dialog?.clientWidth ?? 0,
          dialogScrollWidth: dialog?.scrollWidth ?? 0,
          residentWidth: residentRow?.clientWidth ?? 0,
          residentScrollWidth: residentRow?.scrollWidth ?? 0,
          diffHeight: diff?.clientHeight ?? 0
        };
      });
      expect(residentEditBounds.documentScrollWidth).toBeLessThanOrEqual(
        residentEditBounds.documentWidth + 1
      );
      expect(residentEditBounds.dialogScrollWidth).toBeLessThanOrEqual(
        residentEditBounds.dialogWidth + 1
      );
      expect(residentEditBounds.residentScrollWidth).toBeLessThanOrEqual(
        residentEditBounds.residentWidth + 1
      );
      expect(residentEditBounds.diffHeight).toBeGreaterThan(90);
      await running.page.screenshot({
        path: path.join(
          screenshotDirectory,
          "resident-project-edit-review-compact.png"
        ),
        fullPage: true
      });
      await running.app.evaluate(({ BrowserWindow }) => {
        BrowserWindow.getAllWindows()[0]?.setSize(1440, 900);
      });
      await running.page.waitForTimeout(300);
      await running.page.getByRole("button", { name: "Apply this edit" }).click();
      await expect(
        running.page.getByRole("heading", { name: "The reviewed edit is on disk." })
      ).toBeVisible();
      await running.page
        .getByRole("dialog")
        .getByRole("button", { name: "Undo this edit" })
        .click();
      await expect(
        running.page.getByRole("heading", { name: "The previous file is back." })
      ).toBeVisible();
      await running.page
        .getByRole("dialog")
        .getByRole("button", { name: "Done" })
        .click();
      await expect(running.page.getByRole("dialog")).toBeHidden();
      expect(await readFile(path.join(reviewProject, "src", "app.ts"), "utf8")).toContain(
        "Welcome home"
      );

      await running.page.getByRole("button", { name: /Changes/ }).click();
      await expect(running.page.locator(".diff-view")).toContainText(
        "Welcome home, ${name}"
      );
      await expect(running.page.locator(".diff-view")).toContainText(
        "Welcome ${name}"
      );
      const standardBounds = await running.page.evaluate(() => {
        const room = document.querySelector<HTMLElement>(".room-content");
        const surface = document.querySelector<HTMLElement>(".project-surface");
        return {
          roomHeight: room?.clientHeight ?? 0,
          roomScrollHeight: room?.scrollHeight ?? 0,
          surfaceHeight: surface?.clientHeight ?? 0,
          surfaceScrollHeight: surface?.scrollHeight ?? 0
        };
      });
      expect(standardBounds.roomScrollHeight).toBeLessThanOrEqual(
        standardBounds.roomHeight + 1
      );
      expect(standardBounds.surfaceScrollHeight).toBeLessThanOrEqual(
        standardBounds.surfaceHeight + 1
      );
      await running.page.screenshot({
        path: path.join(screenshotDirectory, "projects.png"),
        fullPage: true
      });

      await running.app.evaluate(({ BrowserWindow }) => {
        BrowserWindow.getAllWindows()[0]?.setSize(1080, 720);
      });
      await running.page.waitForTimeout(400);
      const bounds = await running.page.evaluate(() => ({
        documentWidth: document.documentElement.clientWidth,
        documentScrollWidth: document.documentElement.scrollWidth,
        surfaceWidth: document.querySelector<HTMLElement>(".project-surface")?.clientWidth ?? 0,
        surfaceScrollWidth:
          document.querySelector<HTMLElement>(".project-surface")?.scrollWidth ?? 0,
        roomHeight: document.querySelector<HTMLElement>(".room-content")?.clientHeight ?? 0,
        roomScrollHeight:
          document.querySelector<HTMLElement>(".room-content")?.scrollHeight ?? 0,
        surfaceHeight:
          document.querySelector<HTMLElement>(".project-surface")?.clientHeight ?? 0,
        surfaceScrollHeight:
          document.querySelector<HTMLElement>(".project-surface")?.scrollHeight ?? 0
      }));
      expect(bounds.documentScrollWidth).toBeLessThanOrEqual(bounds.documentWidth + 1);
      expect(bounds.surfaceScrollWidth).toBeLessThanOrEqual(bounds.surfaceWidth + 1);
      expect(bounds.roomScrollHeight).toBeLessThanOrEqual(bounds.roomHeight + 1);
      expect(bounds.surfaceScrollHeight).toBeLessThanOrEqual(bounds.surfaceHeight + 1);
      await running.page.screenshot({
        path: path.join(screenshotDirectory, "projects-compact.png"),
        fullPage: true
      });

      await running.app.evaluate(({ BrowserWindow }) => {
        BrowserWindow.getAllWindows()[0]?.setSize(1440, 900);
      });
      await running.page.waitForTimeout(400);
      await running.page.getByRole("button", { name: /Work here/ }).click();
      await expect(
        running.page.getByRole("heading", { name: "Work with the process in view." })
      ).toBeVisible();
      const bootstrap = await running.page.evaluate(() => window.hearth.bootstrap());
      expect(bootstrap.workspace.selectedProject.rootPath).toBe(reviewProject);

      await running.page.getByRole("button", { name: "Terminal", exact: true }).click();
      await running.page
        .getByRole("button", { name: /^Open .*PowerShell/ })
        .click();
      await expect
        .poll(async () => {
          const snapshot = await running.page.evaluate(() => window.hearth.attachTerminal());
          return snapshot.session?.cwd ?? "";
        }, { timeout: 15_000 })
        .toBe(reviewProject);
      const session = await running.page.evaluate(() => window.hearth.attachTerminal());
      if (session.session) {
        await running.page.evaluate(
          (sessionId) => window.hearth.stopTerminal(sessionId),
          session.session.id
        );
      }
    } finally {
      await running.app.close();
    }
  });

  test("keeps Maker's visible chat with its project through Study and Work here", async () => {
    const running = await launch();
    const reviewMarker = "REVIEW-PROJECT-MAKER-THREAD-ONLY";
    try {
      await running.page
        .getByLabel("Rooms")
        .getByRole("button", { name: /Study/ })
        .click();
      await running.page
        .locator(".project-list")
        .getByRole("button", { name: /Review Project/ })
        .click();
      await running.page.getByRole("button", { name: /Work here/ }).click();
      await expect(running.page.getByLabel("Message Maker")).toHaveCount(1);
      await expect(running.page.locator(".claude-composer")).toHaveCount(1);
      await expect(running.page.locator(".workshop-maker textarea")).toHaveCount(0);
      await running.page.getByLabel("Message Maker").fill(reviewMarker);
      await running.page.getByRole("button", { name: "Send to Maker" }).click();
      await expect(
        running.page.locator(".claude-turn-prompt").getByText(reviewMarker, { exact: true })
      ).toBeVisible();
      const makerReply = await running.page.locator(".workshop-maker .maker-note:not(.maker-note--user) p").last().innerText();
      await expect(running.page.locator(".claude-transcript").getByText(makerReply, { exact: true })).toHaveCount(0);
      const workstreamDatabase = new DatabaseSync(path.join(dataDirectory, "hearth.sqlite"));
      const workstreamUpdatedAt = new Date().toISOString();
      workstreamDatabase.prepare(`
        UPDATE managed_workshop_turns
        SET activities_json = ?, plan_json = ?, thoughts = ?, session_state_json = ?, updated_at = ?
        WHERE id = (SELECT id FROM managed_workshop_turns ORDER BY started_at DESC LIMIT 1)
      `).run(
        JSON.stringify([
          { id: "read-flow", kind: "read", title: "Read protocol flow", status: "completed", locations: ["src/protocol/flow.ts"], toolName: "Read", updatedAt: workstreamUpdatedAt },
          { id: "search-race", kind: "search", title: "Search race condition path", status: "completed", locations: ["src/protocol"], toolName: "Grep", output: "Found 2 results", updatedAt: workstreamUpdatedAt },
          { id: "test-protocol", kind: "execute", title: "Run focused protocol tests", status: "completed", locations: [], toolName: "Bash", input: "npm test -- --grep protocol", output: "All 13 protocol tests passed", updatedAt: workstreamUpdatedAt },
          { id: "edit-flow", kind: "edit", title: "Edit protocol transition", status: "completed", locations: ["src/protocol/flow.ts"], toolName: "Edit", diffs: [{ path: "src/protocol/flow.ts", oldText: "if (state.status === 'ready') {\n  state.emit('advance');\n  state.index += 1;\n}", newText: "if (state.status !== 'ready') {\n  state.index += 1;\n  queueMicrotask(() => this.emit('advance'));\n}" }], updatedAt: workstreamUpdatedAt },
          { id: "agent-test", kind: "other", title: "Test Runner", status: "completed", locations: [], toolName: "Agent", subagent: true, updatedAt: workstreamUpdatedAt }
        ]),
        JSON.stringify([
          { content: "Trace the protocol path", priority: "high", status: "completed" },
          { content: "Prove the race with a focused test", priority: "high", status: "completed" }
        ]),
        "The transition mutates shared state before the queued event can observe it.",
        JSON.stringify({ modeId: "plan", modeName: "Planning", availableModes: [{ id: "default", name: "Manual", description: null }, { id: "auto", name: "Auto", description: null }, { id: "plan", name: "Planning", description: null }], ultracodeRequested: false, contextUsed: 31_400, contextSize: 100_000, inputTokens: 28_000, outputTokens: 3_400, cachedReadTokens: 0, cachedWriteTokens: 0, effortId: "xhigh", effortName: "XHigh", availableEfforts: [{ id: "low", name: "Low", description: null }, { id: "medium", name: "Medium", description: null }, { id: "high", name: "High", description: null }, { id: "xhigh", name: "XHigh", description: null }] }),
        workstreamUpdatedAt
      );
      workstreamDatabase.close();

      const reloadStateDatabase = new DatabaseSync(path.join(dataDirectory, "hearth.sqlite"));
      reloadStateDatabase.prepare(`
        UPDATE managed_workshop_turns
        SET status = 'running', completed_at = NULL
        WHERE id = (SELECT id FROM managed_workshop_turns ORDER BY started_at DESC LIMIT 1)
      `).run();
      reloadStateDatabase.close();
      await running.page.reload();
      await expect(running.page.locator(".claude-turn.is-running")).toBeVisible();
      await expect(running.page.locator(".claude-turn.is-running .claude-turn-status")).toContainText("thinking");

      const completedStateDatabase = new DatabaseSync(path.join(dataDirectory, "hearth.sqlite"));
      completedStateDatabase.prepare(`
        UPDATE managed_workshop_turns
        SET status = 'completed', completed_at = ?, updated_at = ?
        WHERE id = (SELECT id FROM managed_workshop_turns ORDER BY started_at DESC LIMIT 1)
      `).run(workstreamUpdatedAt, workstreamUpdatedAt);
      completedStateDatabase.close();
      await running.page.reload();
      await expect(running.page.locator(".claude-session-bar")).toContainText("Planning");
      await expect(running.page.locator(".claude-turn-status")).toContainText("31.4k tokens");
      const editActivity = running.page.locator("details.claude-event").filter({ hasText: "Edit protocol transition" });
      await expect(editActivity).not.toHaveAttribute("open", "");
      await expect(running.page.locator(".managed-diff-line.is-added")).toHaveCount(0);
      await editActivity.locator("summary").click();
      await expect(running.page.locator(".managed-diff-line.is-added").first()).toBeVisible();
      await expect(running.page.locator(".managed-diff-line.is-removed").first()).toBeVisible();
      await expect(running.page.locator(".claude-agents")).toContainText("Test Runner");
      await expect(running.page.getByRole("button", { name: "Manual terminal" })).toHaveCount(0);
      await expect(running.page.locator(".claude-composer-context")).toHaveCount(0);
      await expect(running.page.locator(".claude-context-meter")).toHaveCount(1);
      await expect(running.page.locator(".claude-context-meter")).toContainText("Context window31.4k / 100k · 31%");
      await running.page.locator(".claude-context-meter").click();
      const contextInspector = running.page.getByRole("dialog", { name: "What Hearth can actually prove" });
      await expect(contextInspector).toBeVisible();
      const closeContextInspector = running.page.getByRole("button", { name: "Close context inspector" });
      await expect(closeContextInspector).toBeFocused();
      await expect(contextInspector).toContainText("Provider reported");
      await expect(contextInspector).toContainText("31.4k / 100k");
      await expect(contextInspector).toContainText("Hearth supplied this turn");
      await expect(contextInspector).toContainText("Current direction");
      await expect(contextInspector).toContainText("Characters, not token guesses");
      await expect(contextInspector).toContainText("does not claim access to hidden provider prompts");
      await running.page.keyboard.press("Escape");
      await expect(contextInspector).toHaveCount(0);
      await expect(running.page.locator(".claude-context-meter")).toBeFocused();
      await expect(running.page.getByRole("button", { name: "Planning" })).toHaveAttribute("title", "Manual → Auto → Planning");
      await expect(running.page.getByLabel("Effort level")).toHaveValue("xhigh");
      await expect(running.page.getByLabel("Effort level").locator("option")).toHaveText(["Low", "Medium", "High", "XHigh"]);
      const makerComposer = running.page.getByLabel("Message Maker");
      const oneLineComposerHeight = await makerComposer.evaluate((element) => element.getBoundingClientRect().height);
      await makerComposer.fill("One\nTwo\nThree\nFour");
      await expect.poll(() => makerComposer.evaluate((element) => element.getBoundingClientRect().height)).toBeGreaterThan(oneLineComposerHeight);
      await makerComposer.fill("");
      const workshopPolish = await running.page.evaluate(() => {
        const workbench = document.querySelector<HTMLElement>(".claude-workbench")!;
        const sessionBar = document.querySelector<HTMLElement>(".claude-session-bar")!;
        const context = document.querySelector<HTMLElement>(".claude-context-meter")!;
        const detail = document.querySelector<HTMLElement>(".claude-event-body section")!;
        const composer = document.querySelector<HTMLElement>(".claude-composer")!;
        const event = document.querySelector<HTMLElement>(".claude-event")!;
        const controls = document.querySelector<HTMLElement>(".claude-composer-controls")!;
        const stop = document.createElement("button");
        stop.className = "managed-send-button is-stop";
        stop.textContent = "Stop";
        controls.append(stop);
        const result = {
          workbenchBackground: getComputedStyle(workbench).backgroundColor,
          detailBackground: getComputedStyle(detail).backgroundColor,
          composerBackground: getComputedStyle(composer).backgroundColor,
          contextOffset: Math.abs(
            context.getBoundingClientRect().left + context.getBoundingClientRect().width / 2 -
              (sessionBar.getBoundingClientRect().left + sessionBar.getBoundingClientRect().width / 2)
          ),
          eventFontSize: Number.parseFloat(getComputedStyle(event).fontSize),
          stopContained: stop.scrollWidth <= stop.clientWidth
        };
        stop.remove();
        return result;
      });
      expect(workshopPolish.detailBackground).toBe(workshopPolish.workbenchBackground);
      expect(workshopPolish.composerBackground).toBe(workshopPolish.workbenchBackground);
      expect(workshopPolish.contextOffset).toBeLessThanOrEqual(2);
      expect(workshopPolish.eventFontSize).toBeGreaterThanOrEqual(10);
      expect(workshopPolish.stopContained).toBe(true);
      await editActivity.locator("summary").click();
      await running.page.screenshot({
        path: path.join(screenshotDirectory, "managed-workshop-unified.png"),
        fullPage: true
      });
      await running.app.evaluate(({ BrowserWindow }) => {
        BrowserWindow.getAllWindows()[0]?.setSize(1100, 720);
      });
      await running.page.waitForTimeout(350);
      const compactWorkshopBounds = await running.page.evaluate(() => {
        const layout = document.querySelector<HTMLElement>(".workshop-layout");
        const workbench = document.querySelector<HTMLElement>(".claude-workbench");
        const maker = document.querySelector<HTMLElement>(".workshop-maker");
        const composer = document.querySelector<HTMLElement>(".claude-composer");
        const context = document.querySelector<HTMLElement>(".claude-context-meter");
        const sessionMeta = document.querySelector<HTMLElement>(".claude-session-meta");
        const contextBounds = context?.getBoundingClientRect();
        const sessionMetaBounds = sessionMeta?.getBoundingClientRect();
        return {
          documentContained: document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
          layoutContained: Boolean(layout && layout.scrollWidth <= layout.clientWidth + 1),
          workbenchContained: Boolean(workbench && workbench.scrollWidth <= workbench.clientWidth + 1),
          makerContained: Boolean(maker && maker.scrollWidth <= maker.clientWidth + 1),
          composerContained: Boolean(composer && composer.scrollWidth <= composer.clientWidth + 1),
          sessionControlsSeparated: Boolean(
            contextBounds &&
            sessionMetaBounds &&
            contextBounds.right <= sessionMetaBounds.left + 1
          )
        };
      });
      expect(compactWorkshopBounds).toEqual({
        documentContained: true,
        layoutContained: true,
        workbenchContained: true,
        makerContained: true,
        composerContained: true,
        sessionControlsSeparated: true
      });
      await running.page.locator(".claude-context-meter").click();
      await expect(contextInspector).toBeVisible();
      const compactInspectorBounds = await contextInspector.evaluate((panel) => {
        const workbench = panel.closest<HTMLElement>(".claude-workbench");
        const workbenchBounds = workbench?.getBoundingClientRect();
        const panelBounds = panel.getBoundingClientRect();
        return {
          horizontallyContained: Boolean(
            workbenchBounds &&
            panelBounds.left >= workbenchBounds.left - 1 &&
            panelBounds.right <= workbenchBounds.right + 1
          ),
          verticallyContained: Boolean(
            workbenchBounds &&
            panelBounds.top >= workbenchBounds.top - 1 &&
            panelBounds.bottom <= workbenchBounds.bottom + 1
          ),
          contentContained: panel.scrollWidth <= panel.clientWidth + 1
        };
      });
      expect(compactInspectorBounds).toEqual({
        horizontallyContained: true,
        verticallyContained: true,
        contentContained: true
      });
      await running.page.screenshot({
        path: path.join(screenshotDirectory, "context-inspector-compact.png"),
        fullPage: true
      });
      await running.page.keyboard.press("Escape");
      await running.page.screenshot({
        path: path.join(screenshotDirectory, "managed-workshop-unified-compact.png"),
        fullPage: true
      });
      await running.app.evaluate(({ BrowserWindow }) => {
        BrowserWindow.getAllWindows()[0]?.setSize(1440, 900);
      });
      await running.page.waitForTimeout(250);

      await running.page
        .getByLabel("Rooms")
        .getByRole("button", { name: /Study/ })
        .click();
      await running.page
        .locator(".project-list")
        .getByRole("button", { name: /PersonalOS/ })
        .click();
      await running.page.getByRole("button", { name: /Work here/ }).click();
      await expect(
        running.page.getByRole("heading", { name: "Work with the process in view." })
      ).toBeVisible();
      await expect(running.page.getByText(reviewMarker, { exact: true })).toHaveCount(0);
      let bootstrap = await running.page.evaluate(() => window.hearth.bootstrap());
      expect(bootstrap.workspace.selectedProject.name).toBe("PersonalOS");
      expect(
        bootstrap.conversations.maker.some((message) => message.text === reviewMarker)
      ).toBe(false);

      await running.page
        .getByLabel("Rooms")
        .getByRole("button", { name: /Study/ })
        .click();
      await running.page
        .locator(".project-list")
        .getByRole("button", { name: /Review Project/ })
        .click();
      await running.page.getByRole("button", { name: /Work here/ }).click();
      await expect(
        running.page.locator(".claude-turn-prompt").getByText(reviewMarker, { exact: true })
      ).toBeVisible();
      bootstrap = await running.page.evaluate(() => window.hearth.bootstrap());
      expect(bootstrap.workspace.selectedProject.name).toBe("Review Project");
      expect(
        bootstrap.conversations.maker.some((message) => message.text === reviewMarker)
      ).toBe(true);
    } finally {
      await running.app.close();
    }
  });

  test("hands bounded project evidence to Critic and Maker separately", async () => {
    const running = await launch();
    try {
      await running.page
        .getByLabel("Rooms")
        .getByRole("button", { name: /Study/ })
        .click();
      await running.page
        .locator(".project-list")
        .getByRole("button", { name: /Review Project/ })
        .click();
      await running.page.getByRole("button", { name: /Changes/ }).click();
      await running.page.getByRole("button", { name: "To Critic" }).click();

      await expect(
        running.page.getByRole("heading", { name: "Make the work defend itself" })
      ).toBeVisible();
      await expect
        .poll(() =>
          running.page
            .locator(".critic-portrait .avatar")
            .evaluate((portrait) => portrait.getBoundingClientRect().width)
        )
        .toBeGreaterThanOrEqual(110);
      await expect(running.page.getByText(/Handoff received: Review Project/)).toBeVisible();
      await expect(running.page.getByText(/without a visible test change/i).first()).toBeVisible();

      const criticComposer = running.page.getByLabel("Message Critic");
      await criticComposer.fill("Is this ready to ship?");
      await criticComposer.press("Shift+Enter");
      await criticComposer.pressSequentially("Don't sugarcoat it.");
      await expect(criticComposer).toHaveValue(
        "Is this ready to ship?\nDon't sugarcoat it."
      );
      await criticComposer.press("Enter");
      await expect(running.page.getByText(/^Not yet\./)).toBeVisible();
      await running.page.screenshot({
        path: path.join(screenshotDirectory, "critic-review.png"),
        fullPage: true
      });
      await running.app.evaluate(({ BrowserWindow }) => {
        BrowserWindow.getAllWindows()[0]?.setSize(1080, 720);
      });
      await running.page.waitForTimeout(400);
      const criticBounds = await running.page.evaluate(() => {
        const layout = document.querySelector<HTMLElement>(".critic-study-layout");
        const conversation = document.querySelector<HTMLElement>(".critic-conversation");
        return {
          documentWidth: document.documentElement.clientWidth,
          documentScrollWidth: document.documentElement.scrollWidth,
          layoutHeight: layout?.clientHeight ?? 0,
          layoutScrollHeight: layout?.scrollHeight ?? 0,
          conversationHeight: conversation?.clientHeight ?? 0,
          conversationScrollHeight: conversation?.scrollHeight ?? 0
        };
      });
      expect(criticBounds.documentScrollWidth).toBeLessThanOrEqual(
        criticBounds.documentWidth + 1
      );
      expect(criticBounds.layoutScrollHeight).toBeLessThanOrEqual(
        criticBounds.layoutHeight + 1
      );
      expect(criticBounds.conversationScrollHeight).toBeLessThanOrEqual(
        criticBounds.conversationHeight + 1
      );
      await running.page.screenshot({
        path: path.join(screenshotDirectory, "critic-compact.png"),
        fullPage: true
      });
      await running.app.evaluate(({ BrowserWindow }) => {
        BrowserWindow.getAllWindows()[0]?.setSize(1440, 900);
      });
      await running.page.waitForTimeout(400);

      await running.page.getByRole("tab", { name: "Project room" }).click();
      await running.page
        .locator(".project-list")
        .getByRole("button", { name: /Review Project/ })
        .click();
      await running.page
        .locator(".directory-list")
        .getByRole("button", { name: /src/ })
        .click();
      await running.page
        .locator(".directory-list")
        .getByRole("button", { name: /app\.ts/ })
        .click();
      await expect(running.page.locator(".project-handoff-scope")).toContainText(
        "1 file"
      );
      await expect(
        running.page.getByRole("button", { name: "Wrap text" })
      ).toHaveCount(0);
      await running.page
        .locator(".breadcrumbs")
        .getByRole("button", { name: "src" })
        .click();
      await running.page
        .locator(".directory-list")
        .getByRole("button", { name: /helper\.ts/ })
        .click({ modifiers: ["Control"] });
      await expect(running.page.locator(".project-handoff-scope")).toContainText(
        "2 files"
      );
      await running.page.screenshot({
        path: path.join(screenshotDirectory, "project-direct-selection.png"),
        fullPage: true
      });
      await running.page.getByRole("button", { name: "Clear selected files" }).click();
      await expect(running.page.locator(".project-handoff-scope")).toContainText(
        "Project review"
      );
      await running.page
        .locator(".directory-list")
        .getByRole("button", { name: /app\.ts/ })
        .click();
      await running.page.getByRole("button", { name: "Find context" }).click();
      await running.page
        .getByLabel("Find a filename, symbol, phrase, or responsibility")
        .fill("supportGreeting");
      await running.page.getByRole("button", { name: "Search project" }).click();
      await running.page
        .locator(".project-evidence-result")
        .filter({ hasText: "src/helper.ts" })
        .click();
      await expect(running.page.getByText("2 of 6 files")).toBeVisible();
      await running.app.evaluate(({ BrowserWindow }) => {
        BrowserWindow.getAllWindows()[0]?.setSize(1040, 700);
      });
      await running.page.waitForTimeout(300);
      const evidenceBounds = await running.page.evaluate(() => {
        const dialog = document.querySelector<HTMLElement>(".project-evidence-dialog");
        const layout = document.querySelector<HTMLElement>(".project-evidence-layout");
        return {
          documentWidth: document.documentElement.clientWidth,
          documentScrollWidth: document.documentElement.scrollWidth,
          dialogWidth: dialog?.clientWidth ?? 0,
          dialogScrollWidth: dialog?.scrollWidth ?? 0,
          layoutHeight: layout?.clientHeight ?? 0,
          layoutScrollHeight: layout?.scrollHeight ?? 0
        };
      });
      expect(evidenceBounds.documentScrollWidth).toBeLessThanOrEqual(
        evidenceBounds.documentWidth + 1
      );
      expect(evidenceBounds.dialogScrollWidth).toBeLessThanOrEqual(
        evidenceBounds.dialogWidth + 1
      );
      expect(evidenceBounds.layoutScrollHeight).toBeLessThanOrEqual(
        evidenceBounds.layoutHeight + 1
      );
      await running.page.screenshot({
        path: path.join(screenshotDirectory, "project-evidence-compact.png"),
        fullPage: true
      });
      await running.app.evaluate(({ BrowserWindow }) => {
        BrowserWindow.getAllWindows()[0]?.setSize(1440, 900);
      });
      await running.page.waitForTimeout(300);
      await running.page.getByRole("button", { name: "Send to Maker" }).click();
      await expect(running.page.getByText(/2 deliberately selected files/)).toBeVisible();
      await expect(running.page.getByText(/src\/app\.ts · src\/helper\.ts/)).toBeVisible();
      await running.page.getByLabel("Message Maker").fill("What do you think I should do next?");
      await running.page.getByRole("button", { name: /Send/ }).click();
      await expect(running.page.getByText(/I’m looking at Review Project\./)).toBeVisible();
      await running.page
        .getByRole("button", { name: /Prepare Workshop handoff/ })
        .click();
      await expect(
        running.page.getByRole("heading", { name: "Work with the process in view." })
      ).toBeVisible();
      await expect(
        running.page.getByRole("heading", { name: "Workshop handoff" })
      ).toBeVisible();
      await expect(running.page.getByText("unknown risk")).toBeVisible();
      await expect(
        running.page.getByText("Critic joined the review")
      ).toBeVisible();
      await expect(
        running.page.getByRole("button", { name: "Open Critic" })
      ).toBeVisible();
      await expect
        .poll(async () => {
          const snapshot = await running.page.evaluate(() => window.hearth.bootstrap());
          return snapshot.makerProposal?.consultations[0]?.reason ?? null;
        })
        .toBe("unknown-risk");
      await expect(running.page.getByLabel("Instruction for Claude Code")).toHaveValue(
        /I’m looking at Review Project/
      );
      await expect(running.page.getByRole("button", { name: "Pass to Claude" })).toBeDisabled();
      await running.page
        .getByLabel("Instruction for Claude Code")
        .fill("Review src/app.ts and keep the change narrow.");
      await running.page.getByRole("button", { name: "Save changes" }).click();
      await running.page.reload();
      await expect(running.page.getByLabel("Instruction for Claude Code")).toHaveValue(
        "Review src/app.ts and keep the change narrow."
      );
      const terminalKind = await running.page.evaluate(async () =>
        (await window.hearth.bootstrap()).terminal.capabilities.claudeAvailable
          ? "claude"
          : "powershell"
      ) as "claude" | "powershell";
      await running.page.evaluate(
        (kind) => window.hearth.startTerminal(kind, "user"),
        terminalKind
      );
      await expect
        .poll(async () => {
          const snapshot = await running.page.evaluate(() => window.hearth.attachTerminal());
          return snapshot.session?.kind === terminalKind &&
            ["starting", "running", "waiting"].includes(
              snapshot.session.lifecycle
            );
        }, { timeout: 15_000 })
        .toBe(true);
      const makerComposer = running.page.getByLabel("Message Maker");
      await makerComposer.pressSequentially(
        "jkljflkdjfkjklfjlkdsajflkdjflkdkfladlkfjlkajfjalkdfjlkdajfjdlkfjdsakfjkadjflkdajlkfjkdalfjkldafjkdajfkdajfkl".repeat(
          5
        ),
        { delay: 1 }
      );
      const typingContainment = await makerComposer.evaluate((textarea) => {
        const composer = textarea.closest<HTMLElement>(".maker-rail-composer");
        const rail = textarea.closest<HTMLElement>(".workshop-maker");
        return {
          textareaScrollLeft: textarea.scrollLeft,
          textareaContained: textarea.scrollWidth <= textarea.clientWidth + 1,
          composerContained: Boolean(
            composer && composer.scrollWidth <= composer.clientWidth + 1
          ),
          railContained: Boolean(rail && rail.scrollWidth <= rail.clientWidth + 1),
          childrenContained: Boolean(
            rail &&
              [...rail.children].every((child) => {
                const element = child as HTMLElement;
                return (
                  element.getBoundingClientRect().width <= rail.clientWidth + 1 &&
                  element.scrollWidth <= element.clientWidth + 1
                );
              })
          )
        };
      });
      expect(typingContainment).toEqual({
        textareaScrollLeft: 0,
        textareaContained: true,
        composerContained: true,
        railContained: true,
        childrenContained: true
      });
      await running.page.screenshot({
        path: path.join(screenshotDirectory, "maker-claude-wide.png"),
        fullPage: true
      });
      await running.app.evaluate(({ BrowserWindow }) => {
        BrowserWindow.getAllWindows()[0]?.setSize(1040, 700);
      });
      await makerComposer.fill("");
      await makerComposer.pressSequentially(
        "jkljflkdjfkjklfjlkdsajflkdjflkdkfladlkfjlkajfjalkdfjlkdajfjdlkfjdsakfjkadjflkdajlkfjkdalfjkldafjkdajfkdajfkl".repeat(
          5
        ),
        { delay: 1 }
      );
      const forcedRailScroll = await makerComposer.evaluate((textarea) => {
        const rail = textarea.closest<HTMLElement>(".workshop-maker");
        if (!rail) return -1;
        rail.scrollLeft = 240;
        return rail.scrollLeft;
      });
      expect(forcedRailScroll).toBe(0);
      await expect
        .poll(() =>
          running.page.evaluate(() => {
            const maker = document.querySelector<HTMLElement>(".workshop-maker");
            const composer = document.querySelector<HTMLElement>(".maker-rail-composer");
            const proposal = document.querySelector<HTMLElement>(".maker-proposal");
            const textarea = document.querySelector<HTMLTextAreaElement>(
              "#workshop-maker-message"
            );
            const makerBounds = maker?.getBoundingClientRect();
            const composerBounds = composer?.getBoundingClientRect();
            const proposalBounds = proposal?.getBoundingClientRect();
            return {
              documentContained:
                document.documentElement.scrollWidth <=
                document.documentElement.clientWidth + 1,
              documentScrollLeft: document.documentElement.scrollLeft,
              textareaScrollLeft: textarea?.scrollLeft ?? -1,
              textareaContained: Boolean(
                textarea && textarea.scrollWidth <= textarea.clientWidth + 1
              ),
              composerContained: Boolean(
                makerBounds &&
                composerBounds &&
                composerBounds.top >= makerBounds.top - 1 &&
                composerBounds.bottom <= makerBounds.bottom + 1
              ),
              proposalContained: Boolean(
                makerBounds &&
                proposalBounds &&
                proposalBounds.top >= makerBounds.top - 1 &&
                proposalBounds.bottom <= makerBounds.bottom + 1
              )
            };
          })
        )
        .toEqual({
          documentContained: true,
          documentScrollLeft: 0,
          textareaScrollLeft: 0,
          textareaContained: true,
          composerContained: true,
          proposalContained: true
        });
      await running.page.screenshot({
        path: path.join(screenshotDirectory, "maker-proposal-compact.png"),
        fullPage: true
      });
      await running.app.evaluate(({ BrowserWindow }) => {
        BrowserWindow.getAllWindows()[0]?.setSize(1440, 900);
      });
      await running.page.waitForTimeout(400);
      await makerComposer.fill("What should Claude tackle first?");
      await makerComposer.press("Shift+Enter");
      await makerComposer.pressSequentially("Keep it bounded.");
      await expect(makerComposer).toHaveValue(
        "What should Claude tackle first?\nKeep it bounded."
      );
      await makerComposer.press("Enter");
      await expect(makerComposer).toHaveValue("");
      await expect
        .poll(async () => {
          const snapshot = await running.page.evaluate(() => window.hearth.bootstrap());
          return snapshot.conversations.maker.some(
            (item) =>
              item.role === "user" &&
              item.text === "What should Claude tackle first?\nKeep it bounded."
          );
        })
        .toBe(true);
      const activeProposal = await running.page.evaluate(
        async () => (await window.hearth.bootstrap()).makerProposal
      );
      expect(activeProposal).not.toBeNull();
      await running.page.evaluate(
        (proposalId) => window.hearth.completeMakerProposal(proposalId),
        activeProposal!.id
      );
      await running.page.reload();
      await expect(
        running.page.getByRole("heading", { name: "Work in progress" })
      ).toBeVisible();
      await expect(running.page.getByText(/watching only for its bounded result/i)).toBeVisible();

      const resultDatabase = new DatabaseSync(path.join(dataDirectory, "hearth.sqlite"));
      const resultTimestamp = new Date().toISOString();
      resultDatabase
        .prepare(`
          UPDATE maker_proposals
          SET result_json = ?, result_at = ?, updated_at = ?
          WHERE id = ?
        `)
        .run(
          JSON.stringify({
            changedFiles: ["src/app.ts", "tests/app.test.ts"],
            validation: ["npm test — passed", "npm run typecheck — passed"],
            concerns: ["Installer smoke test has not run yet"],
            decision: "Build the installer now?",
            corroboration: {
              status: "partial",
              observedFiles: ["src/app.ts"],
              matchedFiles: ["src/app.ts"],
              missingReportedFiles: ["tests/app.test.ts"],
              additionalObservedFiles: [],
              checkedAt: resultTimestamp
            }
          }),
          resultTimestamp,
          resultTimestamp,
          activeProposal!.id
        );
      resultDatabase.close();
      await running.page.reload();
      await expect(
        running.page.getByRole("heading", { name: "Execution report" })
      ).toBeVisible();
      await expect(running.page.getByText("src/app.ts", { exact: true })).toBeVisible();
      await expect(running.page.getByText("npm test — passed")).toBeVisible();
      await expect(running.page.getByText("Build the installer now?")).toBeVisible();
      await expect(running.page.getByText("Git corroboration")).toBeVisible();
      await expect(running.page.getByText("partial", { exact: true })).toBeVisible();
      await running.page.screenshot({
        path: path.join(screenshotDirectory, "maker-execution-report.png"),
        fullPage: true
      });
      await running.page.getByRole("button", { name: "Send to Critic" }).click();
      await expect(
        running.page.getByRole("heading", { name: "Make the work defend itself" })
      ).toBeVisible();
      await expect(running.page.getByText(/Claude Code execution report/i)).toBeVisible();
      await expect(running.page.getByText(/tests\/app\.test\.ts was reported/i)).toBeVisible();
      await running.page.evaluate(
        (proposalId) => window.hearth.closeMakerProposal(proposalId),
        activeProposal!.id
      );
    } finally {
      await running.app.close();
    }
  });

  test("finds and restores quiet records from Archive", async () => {
    const running = await launch();
    try {
      const fixtures = await running.page.evaluate(async () => {
        const library = await window.hearth.saveCapture(
          "https://example.com/archive-e2e-reference",
          "link"
        );
        await window.hearth.updateCapture(library.capture.id, {
          title: "Archive E2E reference",
          archived: true
        });
        const idea = await window.hearth.saveCapture(
          "Archive E2E idea worth reconsidering.",
          "idea"
        );
        await window.hearth.updateCapture(idea.capture.id, {
          ideaState: "let-go"
        });
        const catalog = await window.hearth.listWorkspaceProjects(true);
        const reviewProject = catalog.projects.find(
          (project) => project.name === "Review Project"
        );
        if (!reviewProject) {
          throw new Error("Archive recovery fixture project was not discovered.");
        }
        await window.hearth.selectWorkspaceProject(reviewProject.id);
        const helper = await window.hearth.readProjectFile(
          reviewProject.id,
          "src/helper.ts"
        );
        const editDraft = await window.hearth.prepareProjectEdit(
          reviewProject.id,
          "src/helper.ts",
          `${helper.text.trimEnd()}\n\n// Archive recovery proof.\n`
        );
        const appliedEdit = await window.hearth.applyProjectEdit(editDraft.id);
        await window.hearth.setAgentContext(
          "maker",
          reviewProject.id,
          "project"
        );
        const makerUpdate = await window.hearth.sendAgentMessage(
          "maker",
          "Prepare one archived handoff orientation proof."
        );
        const makerReply = [...makerUpdate.messages]
          .reverse()
          .find((message) => message.role === "assistant");
        if (!makerReply) {
          throw new Error("Maker did not return the Archive handoff fixture.");
        }
        const proposalResult = await window.hearth.createMakerProposal(
          makerReply.id
        );
        const handoff = await window.hearth.updateMakerProposal(
          proposalResult.proposal.id,
          "Archived handoff orientation proof."
        );
        await window.hearth.discardMakerProposal(handoff.id);
        const terminalBefore = await window.hearth.attachTerminal();
        await window.hearth.leaveProject(
          "Stopped after preparing the Archive recovery proof."
        );
        const hearthProject = catalog.projects.find(
          (project) => project.name === "Hearth"
        );
        if (!hearthProject) {
          throw new Error("Hearth source fixture was not discovered.");
        }
        await window.hearth.selectWorkspaceProject(hearthProject.id);
        return {
          libraryId: library.capture.id,
          ideaId: idea.capture.id,
          editId: appliedEdit.record.id,
          terminalId: terminalBefore.session?.id ?? null
        };
      });

      await running.page.reload();
      await running.page
        .getByLabel("Rooms")
        .getByRole("button", { name: /Archive/ })
        .click();
      await expect(
        running.page.getByRole("heading", { name: "Finished doesn’t mean gone." })
      ).toBeVisible();
      await expect(
        running.page.getByRole("heading", {
          name: "Stopped after preparing the Archive recovery proof."
        })
      ).toBeVisible();
      await running.page.screenshot({
        path: path.join(screenshotDirectory, "archive-room.png"),
        fullPage: true
      });
      await running.page
        .getByRole("button", { name: "View on Home" })
        .click();
      await expect(
        running.page.getByLabel("Historical Return Pack")
      ).toContainText("Looking at a saved return point");
      await expect(
        running.page.getByRole("heading", {
          name: "Where you left off"
        })
      ).toBeVisible();
      await running.page.screenshot({
        path: path.join(screenshotDirectory, "archive-home-orientation.png"),
        fullPage: true
      });
      await running.page
        .getByRole("button", { name: "Back to latest" })
        .click();
      await expect(
        running.page.getByLabel("Historical Return Pack")
      ).toHaveCount(0);
      await running.page
        .getByLabel("Rooms")
        .getByRole("button", { name: /Archive/ })
        .click();

      const search = running.page.getByLabel("Search Archive");
      await search.fill("Archive E2E reference");
      const libraryRecord = running.page
        .locator(".archive-record")
        .filter({ hasText: "Archive E2E reference" });
      await expect(libraryRecord).toBeVisible();
      await libraryRecord.click();
      await expect(
        running.page.getByRole("button", { name: "Return to Library" })
      ).toBeVisible();
      await running.page
        .getByRole("button", { name: "Return to Library" })
        .click();
      await expect(libraryRecord).toHaveCount(0);

      await search.fill("Archive E2E idea");
      const ideaRecord = running.page
        .locator(".archive-record")
        .filter({ hasText: "Archive E2E idea" });
      await expect(ideaRecord).toBeVisible();
      await ideaRecord.click();
      await running.page
        .getByRole("button", { name: "Return to Studio" })
        .click();
      await expect(ideaRecord).toHaveCount(0);

      await search.fill("src/helper.ts");
      const editRecord = running.page
        .locator(".archive-record")
        .filter({ hasText: "Undo available" });
      await expect(editRecord).toBeVisible();
      await editRecord.click();
      await running.page
        .getByRole("button", { name: "Open exact file" })
        .click();
      await expect(
        running.page.getByText("Make Review Project current?")
      ).toBeVisible();
      await expect(
        running.page.getByText("No terminal or resident will be started.")
      ).toBeVisible();
      await running.page
        .getByRole("button", { name: "Make current & open file" })
        .click();
      await expect(
        running.page.getByRole("heading", { name: "Projects" })
      ).toBeVisible();
      await expect(
        running.page.getByLabel("Project path").getByText("helper.ts", {
          exact: true
        })
      ).toBeVisible();
      await expect(
        running.page.locator(".file-view").getByText(
          "// Archive recovery proof.",
          { exact: true }
        )
      ).toBeVisible();
      await running.page.screenshot({
        path: path.join(screenshotDirectory, "archive-file-orientation.png"),
        fullPage: true
      });
      await running.page
        .getByLabel("Rooms")
        .getByRole("button", { name: /Archive/ })
        .click();
      await running.page.getByLabel("Search Archive").fill("src/helper.ts");
      const orientedEditRecord = running.page
        .locator(".archive-record")
        .filter({ hasText: "Undo available" });
      await orientedEditRecord.click();
      await running.page
        .getByRole("button", { name: "Undo Hearth edit" })
        .click();
      await expect(
        running.page.getByText(/restore its private backup only if this file/i)
      ).toBeVisible();
      await running.page
        .getByRole("button", { name: "Restore backup" })
        .click();
      await expect(
        running.page.locator(".archive-detail-heading strong").filter({
          hasText: "Restored"
        })
      ).toBeVisible();
      await expect(
        running.page.getByRole("button", { name: "Undo Hearth edit" })
      ).toHaveCount(0);

      const restored = await running.page.evaluate(
        async ({ libraryId, ideaId, editId }) => {
          const data = await window.hearth.bootstrap();
          const helper = await window.hearth.readProjectFile(
            data.workspace.selectedProject.id,
            "src/helper.ts"
          );
          const archive = await window.hearth.getArchive();
          return {
            library: data.captures.find((item) => item.id === libraryId),
            idea: data.captures.find((item) => item.id === ideaId),
            helperText: helper.text,
            edit: archive.items.find((item) => item.id === editId)
          };
        },
        fixtures
      );
      expect(restored.library?.archived).toBe(false);
      expect(restored.idea?.ideaState).toBe("resting");
      expect(restored.helperText).not.toContain("Archive recovery proof");
      expect(restored.edit).toMatchObject({
        kind: "edit",
        status: "Restored",
        action: null
      });

      await running.page.getByLabel("Search Archive").fill(
        "Archived handoff orientation proof"
      );
      const handoffRecord = running.page
        .locator(".archive-record")
        .filter({ hasText: "Archived handoff orientation proof" });
      await expect(handoffRecord).toBeVisible();
      await handoffRecord.click();
      await running.page
        .getByRole("button", { name: "Work in Workshop" })
        .click();
      await expect(
        running.page.getByRole("heading", {
          name: /Work with the process in view|Work in progress/
        })
      ).toBeVisible();
      const terminalAfterOrientation = await running.page.evaluate(() =>
        window.hearth.attachTerminal()
      );
      expect(terminalAfterOrientation.session?.id ?? null).toBe(
        fixtures.terminalId
      );
      expect(
        ["starting", "running", "waiting"].includes(
          terminalAfterOrientation.session?.lifecycle ?? "idle"
        )
      ).toBe(false);
      await running.page
        .getByLabel("Rooms")
        .getByRole("button", { name: /Archive/ })
        .click();

      await running.page
        .getByLabel("Search Archive")
        .fill("Archived handoff orientation proof");
      const removableHandoff = running.page
        .locator(".archive-record")
        .filter({ hasText: "Archived handoff orientation proof" });
      await removableHandoff.click();
      await running.page.getByRole("button", { name: "Remove forever" }).click();
      await expect(
        running.page.getByText("Remove this record forever?")
      ).toBeVisible();
      await expect(
        running.page.getByText("No project files will be touched.")
      ).toBeVisible();
      await running.page.screenshot({
        path: path.join(screenshotDirectory, "archive-remove-confirmation.png"),
        fullPage: true
      });
      await running.page
        .getByRole("button", { name: "Yes, remove forever" })
        .click();
      await expect(removableHandoff).toHaveCount(0);

      await running.page.getByLabel("Search Archive").fill("src/helper.ts");
      const removableEdit = running.page
        .locator(".archive-record")
        .filter({ hasText: "Restored" });
      await removableEdit.click();
      await running.page.getByRole("button", { name: "Remove forever" }).click();
      await expect(
        running.page.getByText("This permanently deletes a backup file.")
      ).toBeVisible();
      await expect(
        running.page.getByText(/project file will not be changed/i)
      ).toBeVisible();
      await running.page
        .getByRole("button", { name: "Yes, remove forever" })
        .click();
      await expect(removableEdit).toHaveCount(0);
      await expect(
        running.page.getByText(
          "Archive record and private backup removed permanently."
        )
      ).toBeVisible();

      await search.fill("");
      await running.app.evaluate(({ BrowserWindow }) => {
        BrowserWindow.getAllWindows()[0]?.setSize(1080, 720);
      });
      await running.page.waitForTimeout(350);
      const archiveBounds = await running.page.locator(".archive-room").evaluate(
        (element) => ({
          clientWidth: element.clientWidth,
          scrollWidth: element.scrollWidth,
          clientHeight: element.clientHeight,
          scrollHeight: element.scrollHeight
        })
      );
      expect(archiveBounds.scrollWidth).toBeLessThanOrEqual(
        archiveBounds.clientWidth + 1
      );
      expect(archiveBounds.scrollHeight).toBeLessThanOrEqual(
        archiveBounds.clientHeight + 1
      );
      await running.page.screenshot({
        path: path.join(screenshotDirectory, "archive-compact.png"),
        fullPage: true
      });

      await running.page.reload();
      await expect(
        running.page.getByRole("heading", { name: "Finished doesn’t mean gone." })
      ).toBeVisible();
    } finally {
      await running.app.close();
    }
  });

  test("keeps one ConPTY session alive across resize, room navigation, and renderer reload", async () => {
    const running = await launch();
    try {
      await running.page
        .getByLabel("Rooms")
        .getByRole("button", { name: /Workshop/ })
        .click();
      await expect(
        running.page.getByRole("heading", { name: "Work with the process in view." })
      ).toBeVisible();
      await running.page.evaluate(() =>
        window.hearth.setAgentProvider("claude-code")
      );
      await running.page.reload();
      await expect(
        running.page.getByRole("heading", { name: "Work with the process in view." })
      ).toBeVisible();
      const providerLabel = await running.page.evaluate(async () =>
        (await window.hearth.bootstrap()).terminal.capabilities.claudeAvailable
          ? "Claude configured Opus"
          : "Hearth local"
      );
      const makerProvider = running.page.locator(".maker-provider");
      await expect(makerProvider).toContainText(
        new RegExp(providerLabel.split(/\s+/).join("\\s*"))
      );
      const providerState = providerLabel === "Hearth local" ? "local" : "online";
      await expect(
        running.page.locator(".maker-status")
      ).toHaveAttribute("aria-label", `${providerLabel} · ${providerState}`);
      await expect(running.page.locator(".maker-status")).toHaveClass(
        providerState === "online" ? /maker-status--online/ : /^maker-status$/
      );
      for (const size of [
        { width: 1440, height: 900 },
        { width: 1080, height: 720 },
        { width: 1040, height: 700 }
      ]) {
        await running.app.evaluate(
          ({ BrowserWindow }, nextSize) => {
            BrowserWindow.getAllWindows()[0]?.setSize(
              nextSize.width,
              nextSize.height
            );
          },
          size
        );
        await running.page.waitForTimeout(180);
        const statusLayout = await running.page.evaluate(() => {
          const heading = document.querySelector<HTMLElement>(
            ".maker-rail-heading"
          )!;
          const avatar = heading.querySelector<HTMLElement>(".avatar")!;
          const status = heading.querySelector<HTMLElement>(".maker-status")!;
          const provider = heading.querySelector<HTMLElement>(".maker-provider")!;
          const dot = status.querySelector<HTMLElement>(".presence-dot")!;
          const headingBox = heading.getBoundingClientRect();
          const avatarBox = avatar.getBoundingClientRect();
          const statusBox = status.getBoundingClientRect();
          const providerBox = provider.getBoundingClientRect();
          const dotBox = dot.getBoundingClientRect();
          return {
            label: provider.innerText.replace(/\s+/g, " ").trim(),
            providerDotGap:
              dotBox.right <= providerBox.left
                ? providerBox.left - dotBox.right
                : dotBox.left - providerBox.right,
            rightInset: headingBox.right - dotBox.right,
            statusAfterAvatar: statusBox.left - avatarBox.right,
            documentContained:
              document.documentElement.scrollWidth <=
              document.documentElement.clientWidth
          };
        });
        expect(statusLayout.label).toBe(providerLabel);
        expect(statusLayout.providerDotGap).toBeGreaterThanOrEqual(6);
        expect(statusLayout.rightInset).toBeGreaterThanOrEqual(16);
        expect(statusLayout.statusAfterAvatar).toBeGreaterThanOrEqual(4);
        expect(statusLayout.documentContained).toBe(true);
      }
      await running.page.screenshot({
        path: path.join(screenshotDirectory, "maker-provider-compact.png"),
        fullPage: true
      });
      await running.app.evaluate(({ BrowserWindow }) => {
        BrowserWindow.getAllWindows()[0]?.setSize(1440, 900);
      });
      await running.page.waitForTimeout(180);
      await expect
        .poll(() =>
          running.page
            .locator(".maker-rail-heading .avatar")
            .evaluate((portrait) => portrait.getBoundingClientRect().width)
        )
        .toBeGreaterThanOrEqual(75);
      const portraitContainment = await running.page.evaluate(() => {
        const heading = document.querySelector<HTMLElement>(".maker-rail-heading");
        const portrait = heading?.querySelector<HTMLElement>(".avatar");
        const headingBox = heading?.getBoundingClientRect();
        const portraitBox = portrait?.getBoundingClientRect();
        return {
          bottom: portraitBox?.bottom ?? 1,
          headingBottom: headingBox?.bottom ?? 0
        };
      });
      expect(portraitContainment.bottom).toBeLessThanOrEqual(
        portraitContainment.headingBottom
      );

      await running.page.getByRole("button", { name: "Terminal", exact: true }).click();
      await running.page
        .getByRole("button", { name: /^Open .*PowerShell/ })
        .click();
      const terminal = running.page.locator(".terminal-host");
      await expect(terminal).toBeVisible();
      await expect(running.page.locator(".runtime-pill")).toHaveClass(
        /runtime-pill--live/
      );
      await expect(running.page.locator(".session-card")).toHaveClass(
        /is-active/
      );
      await expect
        .poll(async () => {
          const snapshot = await running.page.evaluate(() => window.hearth.attachTerminal());
          return snapshot.scrollback;
        }, { timeout: 15_000 })
        .toContain("PS ");
      await expect
        .poll(async () => {
          const snapshot = await running.page.evaluate(() => window.hearth.attachTerminal());
          return snapshot.observation.state;
        })
        .toBe("ready");
      const terminalInput = running.page.locator(".xterm-helper-textarea");
      await expect(terminalInput).toBeFocused();
      await expect(running.page.locator(".terminal-search")).toHaveCount(0);
      await running.page.keyboard.press("Control+Shift+F");
      const terminalSearch = running.page.getByLabel("Find");
      await expect(terminalSearch).toBeFocused();
      await terminal.click({ position: { x: 24, y: 24 } });
      await expect(terminalInput).toBeFocused();
      await running.page.keyboard.press("Control+Shift+F");
      await terminalSearch.focus();
      await terminalSearch.press("Escape");
      await expect(running.page.locator(".terminal-search")).toHaveCount(0);
      await expect(terminalInput).toBeFocused();

      await expect
        .poll(async () => {
          const snapshot = await running.page.evaluate(() => window.hearth.attachTerminal());
          return snapshot.session?.pid ?? 0;
        })
        .toBeGreaterThan(0);
      const originalSnapshot = await running.page.evaluate(() => window.hearth.attachTerminal());
      const originalPid = originalSnapshot.session?.pid;
      expect(originalPid).toBeTruthy();
      const nativeClipboard = await clipboardAvailable(running.page);
      const originalFooter = await running.page.locator(".terminal-footer").innerText();

      await terminal.click();
      await running.page.keyboard.type("Write-Output 'HEARTH-WORKSHOP-READY'");
      await running.page.keyboard.press("Enter");
      await expect
        .poll(async () => {
          const snapshot = await running.page.evaluate(() => window.hearth.attachTerminal());
          return snapshot.scrollback;
        })
        .toContain("HEARTH-WORKSHOP-READY");

      if (nativeClipboard) {
        await running.page.evaluate(async () => {
          await window.hearth.writeClipboard("Write-Output 'HEARTH-PASTE-OK'");
        });
        await terminal.click();
        await running.page.keyboard.press("Control+Shift+V");
        await running.page.keyboard.press("Enter");
      } else {
        await running.page.evaluate(
          ({ sessionId, input }) => window.hearth.terminalInput(sessionId, input),
          {
            sessionId: originalSnapshot.session!.id,
            input: "Write-Output 'HEARTH-PASTE-OK'\r"
          }
        );
      }
      await expect
        .poll(async () => {
          const snapshot = await running.page.evaluate(() => window.hearth.attachTerminal());
          return snapshot.scrollback;
        })
        .toContain("HEARTH-PASTE-OK");

      if (nativeClipboard) {
        await running.page.evaluate(async () => {
          await window.hearth.writeClipboard("Write-Output 'UNICODE café Ω 漢字 🚀'");
        });
        await terminal.click();
        await running.page.keyboard.press("Control+Shift+V");
        await running.page.keyboard.press("Enter");
      } else {
        await running.page.evaluate(
          ({ sessionId, input }) => window.hearth.terminalInput(sessionId, input),
          {
            sessionId: originalSnapshot.session!.id,
            input: "Write-Output 'UNICODE café Ω 漢字 🚀'\r"
          }
        );
      }
      await expect
        .poll(async () => {
          const snapshot = await running.page.evaluate(() => window.hearth.attachTerminal());
          return snapshot.scrollback;
        })
        .toContain("UNICODE café Ω 漢字 🚀");

      await expect
        .poll(() =>
          running.page.evaluate(() =>
            Array.from(
              document.querySelectorAll<HTMLElement>(".xterm-accessibility-tree > div")
            )
              .map((row) => row.textContent ?? "")
              .join("\n")
          )
        )
        .toContain("HEARTH-WORKSHOP-READY");
      const selectedForCopy = await running.page.evaluate(() => {
        const rows = Array.from(
          document.querySelectorAll<HTMLElement>(".xterm-accessibility-tree > div")
        );
        const row = rows.find((candidate) =>
          candidate.textContent?.includes("HEARTH-WORKSHOP-READY")
        );
        const text = row?.firstChild;
        const content = text?.textContent ?? "";
        const start = content.indexOf("HEARTH-WORKSHOP-READY");
        if (!text || start < 0) {
          return false;
        }
        const selection = window.getSelection();
        const range = document.createRange();
        range.setStart(text, start);
        range.setEnd(text, start + "HEARTH-WORKSHOP-READY".length);
        selection?.removeAllRanges();
        selection?.addRange(range);
        return true;
      });
      expect(selectedForCopy).toBe(true);
      if (nativeClipboard) {
        await running.page.locator(".xterm-helper-textarea").press("Control+Shift+C");
        await expect
          .poll(() => running.page.evaluate(() => window.hearth.readClipboard()))
          .toContain("HEARTH-WORKSHOP-READY");
      }

      const longLine = `RESIZE-LINE-${"ABCDEFGHIJ".repeat(18)}-END`;
      await terminal.click();
      await running.page.keyboard.type(`Write-Output '${longLine}'`);
      await running.page.keyboard.press("Enter");
      await terminal.click();
      await running.page.keyboard.type("Write-Output 'https://example.com/hearth-terminal-link'");
      await running.page.keyboard.press("Enter");
      await expect
        .poll(async () => {
          const snapshot = await running.page.evaluate(() => window.hearth.attachTerminal());
          return snapshot.scrollback;
        })
        .toContain("https://example.com/hearth-terminal-link");

      await terminal.click();
      await running.page.keyboard.press("Control+Shift+F");
      await running.page.getByLabel("Find").fill("HEARTH-WORKSHOP-READY");
      await running.page.getByRole("button", { name: "Next match" }).click();
      await running.page.getByLabel("Find").press("Escape");

      await running.app.evaluate(({ BrowserWindow }) => {
        BrowserWindow.getAllWindows()[0]?.setSize(1080, 720);
      });
      await running.page.waitForTimeout(500);
      const compactSize = await running.page.locator(".terminal-footer").innerText();
      expect(compactSize).not.toBe(originalFooter);
      const compactBounds = await terminal.evaluate((element) => ({
        clientWidth: element.clientWidth,
        scrollWidth: element.scrollWidth,
        clientHeight: element.clientHeight,
        scrollHeight: element.scrollHeight
      }));
      expect(compactBounds.scrollWidth).toBeLessThanOrEqual(compactBounds.clientWidth + 1);
      expect(compactBounds.scrollHeight).toBeLessThanOrEqual(compactBounds.clientHeight + 1);
      const compactComposer = running.page.locator(".maker-rail-composer");
      await expect(compactComposer.getByRole("button", { name: "Talk" })).toBeVisible();
      const compactComposerBounds = await compactComposer.boundingBox();
      const compactViewportHeight = await running.page.evaluate(() => window.innerHeight);
      expect(compactComposerBounds).not.toBeNull();
      expect(
        (compactComposerBounds?.y ?? 0) + (compactComposerBounds?.height ?? 0)
      ).toBeLessThanOrEqual(compactViewportHeight + 1);
      await running.page.screenshot({
        path: path.join(screenshotDirectory, "workshop-compact.png"),
        fullPage: true
      });

      await running.app.evaluate(({ BrowserWindow }) => {
        BrowserWindow.getAllWindows()[0]?.setSize(1440, 900);
      });
      await running.page.waitForTimeout(500);
      const resizedSnapshot = await running.page.evaluate(() => window.hearth.attachTerminal());
      expect(resizedSnapshot.scrollback).toContain("RESIZE-LINE-");

      await running.page.getByLabel("Rooms").getByRole("button", { name: /Home/ }).click();
      await expect(running.page.getByText("1 session running quietly")).toBeVisible();
      await running.page
        .getByLabel("Rooms")
        .getByRole("button", { name: /Workshop/ })
        .click();
      await expect(running.page.locator(".terminal-footer")).toContainText(`PID ${originalPid}`);

      await running.page.reload();
      await expect(
        running.page.getByRole("heading", { name: "Work with the process in view." })
      ).toBeVisible();
      await expect(running.page.locator(".terminal-footer")).toContainText(`PID ${originalPid}`);
      const reattached = await running.page.evaluate(() => window.hearth.attachTerminal());
      expect(reattached.scrollback).toContain("HEARTH-WORKSHOP-READY");

      const roomDimensions = await running.page.locator(".terminal-footer").innerText();
      const roomTerminalWidth = await terminal.evaluate((element) => element.clientWidth);
      await running.page.getByRole("button", { name: "Hide sessions" }).click();
      await expect(running.page.locator(".session-shelf")).toHaveCount(0);
      await expect(running.page.locator(".workshop-maker")).toHaveCount(1);
      await expect(running.page.getByRole("button", { name: "Show sessions" })).toBeVisible();
      await expect
        .poll(() => terminal.evaluate((element) => element.clientWidth))
        .toBeGreaterThan(roomTerminalWidth);
      await running.page.screenshot({
        path: path.join(screenshotDirectory, "workshop-sessions-collapsed.png"),
        fullPage: true
      });
      await running.page.getByRole("button", { name: "Show sessions" }).click();
      await expect(running.page.locator(".session-shelf")).toBeVisible();

      await running.page.getByRole("button", { name: "Focus terminal" }).click();
      await expect(running.page.locator(".sidebar")).toHaveCount(0);
      await expect(running.page.getByRole("button", { name: "Restore room" })).toBeVisible();
      await expect(running.page.locator(".terminal-footer")).toContainText(`PID ${originalPid}`);
      await expect
        .poll(() => running.page.locator(".terminal-footer").innerText())
        .not.toBe(roomDimensions);
      await running.page.screenshot({
        path: path.join(screenshotDirectory, "workshop-focus.png"),
        fullPage: true
      });
      await running.page.getByRole("button", { name: "Restore room" }).click();

      await running.page.evaluate(
        ({ sessionId }) => window.hearth.setTerminalOwner(sessionId, "maker"),
        { sessionId: originalSnapshot.session!.id }
      );
      await expect(
        running.page.getByText("I can see the terminal.")
      ).toBeVisible();
      await expect(
        running.page.getByText("Maker can read the recent terminal")
      ).toBeVisible();
      await expect(
        running.page.getByText(
          "Instructions still use an explicit handoff. You can watch, copy, and search."
        )
      ).toBeVisible();
      await running.page
        .getByLabel("Terminal control")
        .getByRole("button", { name: "You" })
        .click();
      await expect(terminalInput).toBeFocused();

      await running.page.screenshot({
        path: path.join(screenshotDirectory, "workshop-terminal.png"),
        fullPage: true
      });

      await expect(running.page.locator(".terminal-search")).toHaveCount(0);
      await running.page.keyboard.press("Control+Shift+F");
      await expect(running.page.getByPlaceholder("Search output")).toBeFocused();
      await running.page.keyboard.press("Escape");
      await expect(running.page.locator(".terminal-search")).toHaveCount(0);

      await running.page.getByRole("button", { name: "Stop" }).click();
      await expect(running.page.getByRole("dialog", { name: /Stop/ })).toBeVisible();
      await running.page.getByRole("button", { name: "Keep running" }).click();
      await expect(running.page.locator(".terminal-footer")).toContainText(`PID ${originalPid}`);
      await running.page.getByRole("button", { name: "Stop" }).click();
      await running.page.getByRole("button", { name: "Stop session" }).click();
      await expect(running.page.locator(".terminal-footer")).toContainText("PID stopped");
    } finally {
      try {
        const snapshot = await running.page.evaluate(() => window.hearth.attachTerminal());
        if (
          snapshot.session &&
          ["starting", "running", "waiting"].includes(snapshot.session.lifecycle)
        ) {
          await running.page.evaluate(
            (sessionId) => window.hearth.stopTerminal(sessionId),
            snapshot.session.id
          );
        }
      } catch {
        // The window may already be closed after a successful explicit stop.
      }
      await running.app.close();
    }
  });

  test("reviews, edits, adopts, dismisses, restores, and forgets a House Practice", async () => {
    const running = await launch();
    try {
      await running.page.evaluate(async () => {
        const attached = await window.hearth.attachTerminal();
        if (attached.session && attached.session.lifecycle !== "stopped") {
          await window.hearth.stopTerminal(attached.session.id);
        }
        for (let index = 0; index < 3; index += 1) {
          const started = await window.hearth.startTerminal("powershell", "user");
          if (!started.session) throw new Error("PowerShell practice fixture did not start.");
          await window.hearth.stopTerminal(started.session.id);
        }
        await window.hearth.bootstrap();
      });

      await running.page.getByLabel("Rooms").getByRole("button", { name: /Home/ }).click();
      await running.page.locator(".house-memory-open").click();
      const dialog = running.page.getByRole("dialog", {
        name: "What the house remembers"
      });
      const suggestion = dialog
        .locator(".house-memory-card.is-suggestion")
        .filter({ hasText: "re-entry" })
        .first();
      await expect(suggestion).toBeVisible();
      await expect(suggestion).toContainText("Practice suggestion");
      await expect(suggestion).toContainText("What approval changes");
      await expect(suggestion).toContainText("supporting records");
      await expect(suggestion).toContainText("Guidance only");
      await suggestion.getByText("Why Hearth suggested this").click();
      await expect(suggestion).toContainText("No project files, terminal output, or conversation text");
      await running.page.screenshot({
        path: path.join(screenshotDirectory, "house-practice-review.png"),
        fullPage: true
      });
      await running.app.evaluate(({ BrowserWindow }) => {
        BrowserWindow.getAllWindows()[0]?.setSize(1080, 720);
      });
      await running.page.waitForTimeout(200);
      const compactBounds = await running.page.evaluate(() => {
        const dialogElement = document.querySelector<HTMLElement>(".house-memory-dialog");
        return {
          documentWidth: document.documentElement.scrollWidth,
          viewportWidth: document.documentElement.clientWidth,
          dialogRight: dialogElement?.getBoundingClientRect().right ?? 0,
          dialogHeight: dialogElement?.getBoundingClientRect().height ?? 0,
          viewportHeight: document.documentElement.clientHeight
        };
      });
      expect(compactBounds.documentWidth).toBe(compactBounds.viewportWidth);
      expect(compactBounds.dialogRight).toBeLessThanOrEqual(compactBounds.viewportWidth);
      expect(compactBounds.dialogHeight).toBeLessThanOrEqual(compactBounds.viewportHeight);
      await running.page.screenshot({
        path: path.join(screenshotDirectory, "house-practice-review-1080.png"),
        fullPage: true
      });
      await running.app.evaluate(({ BrowserWindow }) => {
        BrowserWindow.getAllWindows()[0]?.setSize(1440, 900);
      });

      await suggestion.getByRole("button", { name: "Edit first" }).click();
      await dialog
        .getByLabel("What should Hearth remember?")
        .fill("Keep my return to this project short, calm, and concrete.");
      await dialog.getByRole("button", { name: "Save correction" }).click();
      const corrected = dialog
        .locator(".house-memory-card.is-suggestion")
        .filter({ hasText: "short, calm, and concrete" });
      await expect(corrected).toBeVisible();

      await corrected.getByRole("button", { name: "Not useful" }).click();
      await expect(corrected).toHaveCount(0);
      await dialog.getByRole("button", { name: /Review \d+ ignored/ }).click();
      const ignored = dialog
        .locator(".house-memory-card.is-dismissed")
        .filter({ hasText: "short, calm, and concrete" });
      await expect(ignored).toContainText("Still ignored");
      await ignored.getByRole("button", { name: "Put back" }).click();

      const restored = dialog
        .locator(".house-memory-card.is-suggestion")
        .filter({ hasText: "short, calm, and concrete" });
      await restored.getByRole("button", { name: "Adopt practice" }).click();
      const approved = dialog
        .locator(".house-memory-card:not(.is-suggestion):not(.is-dismissed)")
        .filter({ hasText: "short, calm, and concrete" });
      await expect(approved).toContainText("Approved effect");
      await expect(approved).toContainText("No added authority");
      await approved.getByRole("button", { name: "Forget" }).click();
      await approved.getByRole("button", { name: "Forget it" }).click();
      await expect(approved).toHaveCount(0);
      await expect(
        dialog.locator(".house-memory-card.is-dismissed").filter({
          hasText: "short, calm, and concrete"
        })
      ).toBeVisible();
    } finally {
      await running.app.close();
    }
  });

  test("stops a live terminal on full app exit and reports resumable truth after relaunch", async () => {
    let running = await launch();
    await running.page
      .getByLabel("Rooms")
      .getByRole("button", { name: /Workshop/ })
      .click();
    await running.page.getByRole("button", { name: "Terminal", exact: true }).click();
    await running.page
      .getByRole("button", { name: /^Open .*PowerShell/ })
      .click();
    await expect
      .poll(async () => {
        const snapshot = await running.page.evaluate(() => window.hearth.attachTerminal());
        return snapshot.session?.pid ?? 0;
      }, { timeout: 15_000 })
      .toBeGreaterThan(0);

    const closeStartedAt = Date.now();
    await running.app.close();
    expect(Date.now() - closeStartedAt).toBeLessThan(10_000);

    running = await launch();
    try {
      const restored = await running.page.evaluate(() => window.hearth.attachTerminal());
      expect(restored.session?.lifecycle).toBe("stopped");
      expect(restored.session?.pid).toBeNull();
      await running.page.getByRole("button", { name: /Home/ }).click();
      await expect(running.page.getByText("No blockers · no live processes")).toBeVisible();
      await expect(
        running.page.getByText("The last Workshop terminal is stopped. No external process is running.")
      ).toBeVisible();
    } finally {
      await running.app.close();
    }
  });
});
