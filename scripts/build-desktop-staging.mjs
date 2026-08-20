import { rm } from "node:fs/promises";
import { build } from "esbuild";

await rm("dist-main", { recursive: true, force: true });
await build({
  absWorkingDir: process.cwd(),
  bundle: true,
  entryPoints: {
    "main/main": "src/main/main.ts",
    "main/preload": "src/main/preload.ts",
    "core/core": "src/core/core.ts"
  },
  external: ["electron", "node:sqlite", "node-pty"],
  format: "cjs",
  outdir: "dist-main",
  outExtension: { ".js": ".cjs" },
  platform: "node",
  sourcemap: true,
  target: "node24"
});
