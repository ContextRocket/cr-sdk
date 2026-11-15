#!/usr/bin/env node

/** Stage only the standalone browser artifacts for operator CDN publishing. */

import { copyFile, mkdir, readFile, rm, stat } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { browserArtifactVersion } from "./browser-artifact-version.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const scratch = resolve(root, "scratchpad/cdn/embeds");

async function artifactVersion(packageJsonPath) {
  const pkg = JSON.parse(await readFile(resolve(root, packageJsonPath), "utf8"));
  return browserArtifactVersion(pkg, packageJsonPath);
}

const artifacts = [
  {
    name: "chat widget",
    packageJson: "packages/embed-chat/package.json",
    source: "packages/embed-chat/dist/widget.js",
    prefix: "chat",
    filename: "widget.js",
  },
  {
    name: "contact-form browser bridge",
    packageJson: "packages/sdk/package.json",
    source: "packages/sdk/dist/contact-form.browser.js",
    prefix: "contact-form",
    filename: "contact-form.browser.js",
  },
  {
    name: "site behaviors browser bundle",
    packageJson: "packages/sdk/package.json",
    source: "packages/sdk/dist/site-behaviors.browser.js",
    prefix: "site-behaviors",
    filename: "site-behaviors.browser.js",
  },
];

await rm(scratch, { recursive: true, force: true });

for (const artifact of artifacts) {
  const version = await artifactVersion(artifact.packageJson);
  const sourcePath = resolve(root, artifact.source);
  const sourceStat = await stat(sourcePath).catch(() => null);
  if (!sourceStat?.isFile() || sourceStat.size === 0) {
    throw new Error(
      `Missing built ${artifact.name}: ${artifact.source}. Run pnpm build first.`,
    );
  }

  const releasePath = resolve(
    scratch,
    artifact.prefix,
    `v${version}`,
    artifact.filename,
  );
  await mkdir(dirname(releasePath), { recursive: true });
  await copyFile(sourcePath, releasePath);
  console.log(
    `Prepared ${artifact.name}: scratchpad/cdn/embeds/${artifact.prefix}/v${version}/${artifact.filename} (${sourceStat.size} bytes)`,
  );
}
