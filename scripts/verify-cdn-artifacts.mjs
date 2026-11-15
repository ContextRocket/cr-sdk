#!/usr/bin/env node

/** Verify public CDN files against the current local package builds. */

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { browserArtifactVersion } from "./browser-artifact-version.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const origin = "https://contextrocket.cdn.contextrocket.com";

const artifacts = [
  {
    packageJson: "packages/embed-chat/package.json",
    output: "packages/embed-chat/dist/widget.js",
    prefix: "chat",
    filename: "widget.js",
  },
  {
    packageJson: "packages/sdk/package.json",
    output: "packages/sdk/dist/contact-form.browser.js",
    prefix: "contact-form",
    filename: "contact-form.browser.js",
  },
  {
    packageJson: "packages/sdk/package.json",
    output: "packages/sdk/dist/site-behaviors.browser.js",
    prefix: "site-behaviors",
    filename: "site-behaviors.browser.js",
  },
];

const artifactArgument = process.argv.find((argument) =>
  argument.startsWith("--artifacts="),
);
const selectedPrefixes = artifactArgument
  ? artifactArgument
      .slice("--artifacts=".length)
      .split(",")
      .filter(Boolean)
  : null;
if (selectedPrefixes?.length === 0) {
  throw new Error("--artifacts requires a comma-separated prefix list");
}
const knownPrefixes = new Set(artifacts.map(({ prefix }) => prefix));
const unknownPrefixes = selectedPrefixes?.filter(
  (prefix) => !knownPrefixes.has(prefix),
);
if (unknownPrefixes?.length) {
  const expectedPrefixes = [...knownPrefixes].join(", ");
  throw new Error(
    `Unknown artifact prefix(es): ${unknownPrefixes.join(", ")}; expected ${expectedPrefixes}`,
  );
}
const selectedArtifacts = selectedPrefixes
  ? artifacts.filter(({ prefix }) => selectedPrefixes.includes(prefix))
  : artifacts;

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

for (const artifact of selectedArtifacts) {
  const packageJson = JSON.parse(
    await readFile(resolve(root, artifact.packageJson), "utf8"),
  );
  const version = browserArtifactVersion(packageJson, artifact.packageJson);

  const local = await readFile(resolve(root, artifact.output));
  const url = `${origin}/embeds/${artifact.prefix}/v${version}/${artifact.filename}`;
  const response = await fetch(url, { redirect: "error" });
  const contentType = response.headers.get("content-type") ?? "";
  if (!response.ok) {
    throw new Error(`${url} returned HTTP ${response.status}`);
  }
  if (!contentType.toLowerCase().includes("javascript")) {
    throw new Error(
      `${url} returned unexpected content type: ${contentType || "missing"}`,
    );
  }

  const remote = Buffer.from(await response.arrayBuffer());
  const localHash = sha256(local);
  const remoteHash = sha256(remote);
  if (localHash !== remoteHash) {
    throw new Error(
      `${url} bytes differ from ${artifact.output} (local ${localHash}; CDN ${remoteHash})`,
    );
  }

  console.log(
    `verified ${url} (${contentType}, ${remote.length} bytes, sha256 ${remoteHash})`,
  );
}
