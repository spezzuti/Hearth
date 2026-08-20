import { createRequire } from "node:module";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const require = createRequire(import.meta.url);
const { NtExecutable, NtExecutableResource } = require("resedit");
const { computeData } = require("app-builder-lib/out/asar/integrity.js");
const { addWinAsarIntegrity } = require("app-builder-lib/out/electron/electronWin.js");

const appRoot = path.resolve("prepackaged/win-unpacked");
const executablePath = path.join(appRoot, "Hearth.exe");
const resourcesPath = path.join(appRoot, "resources");

const executable = NtExecutable.from(await readFile(executablePath));
const resources = NtExecutableResource.from(executable);
resources.entries = resources.entries.filter(
  (entry) => !(entry.type === "INTEGRITY" && entry.id === "ELECTRONASAR")
);
resources.outputResource(executable);
await writeFile(executablePath, Buffer.from(executable.generate()));

const integrity = await computeData({
  resourcesPath,
  resourcesRelativePath: "resources",
  resourcesDestinationPath: resourcesPath,
  extraResourceMatchers: []
});
for (let attempt = 0; ; attempt += 1) {
  try {
    await addWinAsarIntegrity(executablePath, integrity);
    break;
  } catch (error) {
    if (attempt >= 4 || error?.code !== "EBUSY") throw error;
    await new Promise((resolve) => setTimeout(resolve, 750));
  }
}
