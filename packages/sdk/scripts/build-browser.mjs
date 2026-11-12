import { build } from "esbuild";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const artifacts = [
  ["src/browser-contact-form.ts", "dist/contact-form.browser.js"],
  ["src/browser-site-behaviors.ts", "dist/site-behaviors.browser.js"],
];

for (const [entry, output] of artifacts) {
  const outFile = resolve(root, output);
  mkdirSync(dirname(outFile), { recursive: true });
  await build({
    entryPoints: [resolve(root, entry)],
    bundle: true,
    format: "iife",
    platform: "browser",
    target: ["es2020"],
    outfile: outFile,
    legalComments: "none",
  });
}
