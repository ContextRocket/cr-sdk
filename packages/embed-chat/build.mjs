#!/usr/bin/env node
/**
 * Bundle the chat embed widget to dist/widget.js (IIFE).
 *
 * Consumers copy this file into their public/embed/ (or load it from CDN later).
 * Local starter workflow: pnpm --dir ../cr-sdk/packages/embed-chat build
 * then cp dist/widget.js <site>/public/embed/widget.js
 */
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import esbuild from "esbuild";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outFile = resolve(__dirname, "dist/widget.js");

mkdirSync(dirname(outFile), { recursive: true });

await esbuild.build({
  entryPoints: [resolve(__dirname, "src/index.ts")],
  outfile: outFile,
  bundle: true,
  format: "iife",
  globalName: "ContextRocketWidget",
  platform: "browser",
  target: ["es2020"],
  loader: { ".svg": "text" },
  minify: true,
  sourcemap: false,
  legalComments: "none",
  logLevel: "info",
});

console.log(`Wrote ${outFile}`);
