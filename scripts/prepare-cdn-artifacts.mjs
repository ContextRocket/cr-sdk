#!/usr/bin/env node

/** Stage only the standalone browser artifacts for operator CDN publishing. */

import { copyFile, mkdir, readFile, stat } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const scratch = resolve(root, "scratchpad/cdn/embeds");

async function packageVersion(packageJsonPath) {
  const pkg = JSON.parse(await readFile(resolve(root, packageJsonPath), "utf8"));
  if (typeof pkg.version !== "string" || !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(pkg.version)) {
    throw new Error(`Invalid package version in ${packageJsonPath}`);
  }
  return pkg.version;
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
];

for (const artifact of artifacts) {
  const version = await packageVersion(artifact.packageJson);
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
