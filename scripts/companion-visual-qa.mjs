import { _electron as electron } from "playwright";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const root = path.resolve(".");
const dataDirectory = await mkdtemp(path.join(os.tmpdir(), "hearth-companion-qa-"));
const screenshotPath = path.join(root, "artifacts", "companion-rig-qa.png");
await mkdir(path.dirname(screenshotPath), { recursive: true });

let app;
try {
  app = await electron.launch({
    args: ["."],
    env: { ...process.env, HEARTH_DATA_DIR: dataDirectory, HEARTH_HOME_ROOT: path.dirname(root) }
  });
  const page = await app.firstWindow({ timeout: 15_000 });
  await page.waitForLoadState("domcontentloaded");
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.hide());
  const companion = page.getByRole("button", { name: "Talk to Companion" });
  await companion.waitFor({ state: "visible" });
  await page.evaluate(() => {
    const button = document.querySelector(".companion-button");
    if (!button) throw new Error("Companion button missing.");
    const box = button.getBoundingClientRect();
    window.dispatchEvent(new PointerEvent("pointermove", {
      clientX: box.left + box.width + 190,
      clientY: box.top + 18
    }));
  });
  await page.waitForTimeout(240);
  const metrics = await page.locator(".companion-character--rig").evaluate((node) => {
    const root = node.getBoundingClientRect();
    const body = node.querySelector(".companion-rig-body")?.getBoundingClientRect();
    const head = node.querySelector(".companion-rig-head")?.getBoundingClientRect();
    const lamps = [...node.querySelectorAll(".companion-rig-lamp img")].map((image) => image.getBoundingClientRect());
    return {
      root: { width: root.width, height: root.height },
      body: body && { width: body.width, height: body.height },
      head: head && { width: head.width, height: head.height },
      lamps: lamps.map((lamp) => ({ width: lamp.width, height: lamp.height })),
      hasAtlas: Boolean(node.querySelector(".companion-atlas-image"))
    };
  });
  if (metrics.hasAtlas || metrics.root.width !== 132 || metrics.root.height !== 142) {
    throw new Error(`Companion rig geometry is invalid: ${JSON.stringify(metrics)}`);
  }
  if (metrics.body?.width !== 132 || metrics.head?.width !== 132 || metrics.lamps.some((lamp) => lamp.width !== 132)) {
    throw new Error(`Companion layers are not fixed-size: ${JSON.stringify(metrics)}`);
  }
  const clip = await page.locator(".companion").evaluate((node) => {
    const box = node.getBoundingClientRect();
    return { x: box.x, y: box.y, width: box.width, height: box.height };
  });
  await page.screenshot({ path: screenshotPath, clip, animations: "disabled" });
  console.log(JSON.stringify({ visualQa: "pass", screenshotPath, metrics }));
} catch (error) {
  await writeFile(
    path.join(root, "artifacts", "companion-rig-qa.error.txt"),
    error instanceof Error ? `${error.stack}\n` : String(error)
  );
  throw error;
} finally {
  await app?.evaluate(({ app }) => app.quit()).catch(() => undefined);
  await rm(dataDirectory, { recursive: true, force: true });
}
