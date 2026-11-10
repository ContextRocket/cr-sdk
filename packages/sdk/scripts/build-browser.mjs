import { build } from "esbuild";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outFile = resolve(root, "dist/lead-capture.browser.js");
mkdirSync(dirname(outFile), { recursive: true });

await build({
  entryPoints: [resolve(root, "src/browser-lead-capture.ts")],
  bundle: true,
  format: "iife",
  platform: "browser",
  target: ["es2020"],
  outfile: outFile,
  legalComments: "none",
});
