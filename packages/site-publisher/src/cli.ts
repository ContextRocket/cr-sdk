#!/usr/bin/env node

import { resolve } from "node:path";
import { config as loadDotEnv } from "dotenv";
import { prepareSiteArchive } from "./archive.js";
import { resolveOrgHandle } from "./config.js";
import {
  normalizeOrgHandle,
  normalizeSitePathPrefix,
  publishPreparedSiteArchive,
  SitePublisherError,
} from "./client.js";

interface CliOptions {
  sourcePath?: string;
  orgHandle?: string;
  pathPrefix?: string;
  apiBase?: string;
  envFile?: string;
  timeoutSeconds: number;
  exclude: string[];
  dryRun: boolean;
  noWait: boolean;
  help: boolean;
}

const HELP = `ContextRocket static site publisher

Usage:
  contextrocket-site-publish <built-site-directory> --org <handle> [options]

Options:
  --org <handle>       Target organization handle (defaults to CR_ORG_HANDLE,
                       PUBLIC_CONTEXTROCKET_HANDLE, or config/site.json)
  --prefix <path>      CDN path prefix; omit to publish at the org root
  --exclude <glob>     Exclude a relative path or basename (repeatable)
  --api-base <url>     API origin (default: https://api.contextrocket.com)
  --env-file <path>    Load CR_API_TOKEN and optional CR_API_BASE from a dotenv file
  --timeout <seconds>  Upload/status timeout (default: 600)
  --dry-run            Package locally without uploading or requiring a token
  --no-wait            Queue publish and print its status URL
  -h, --help           Show this help

Credentials:
  Set CR_API_TOKEN to a private, admin-scoped organization machine token.
  The token is sent only to the ContextRocket API and is never printed.
  Never use a browser API key or a PUBLIC_* variable for publishing.
`;

function parseArgs(args: readonly string[]): CliOptions {
  const options: CliOptions = {
    timeoutSeconds: 600,
    exclude: [],
    dryRun: false,
    noWait: false,
    help: false,
  };
  const valueOptions = new Set([
    "--org",
    "--prefix",
    "--api-base",
    "--env-file",
    "--timeout",
    "--exclude",
  ]);
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "-h" || argument === "--help") {
      options.help = true;
      continue;
    }
    if (argument === "--dry-run") {
      options.dryRun = true;
      continue;
    }
    if (argument === "--no-wait") {
      options.noWait = true;
      continue;
    }
    if (valueOptions.has(argument)) {
      const value = args[index + 1];
      if (!value || value.startsWith("--")) {
        throw new TypeError(`Option ${argument} requires a value.`);
      }
      index += 1;
      switch (argument) {
        case "--org":
          options.orgHandle = value;
          break;
        case "--prefix":
          options.pathPrefix = value;
          break;
        case "--api-base":
          options.apiBase = value;
          break;
        case "--env-file":
          options.envFile = value;
          break;
        case "--exclude":
          options.exclude.push(value);
          break;
        case "--timeout": {
          const seconds = Number(value);
          if (!Number.isFinite(seconds) || seconds <= 0) {
            throw new TypeError("--timeout must be a positive number of seconds.");
          }
          options.timeoutSeconds = seconds;
          break;
        }
      }
      continue;
    }
    if (argument.startsWith("-")) {
      throw new TypeError(`Unknown option: ${argument}`);
    }
    if (options.sourcePath) throw new TypeError("Only one site path can be published at a time.");
    options.sourcePath = argument;
  }
  if (!options.help && !options.sourcePath) {
    throw new TypeError("A built-site path is required.");
  }
  return options;
}

async function main(): Promise<void> {
  let options: CliOptions;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Invalid command arguments.");
    console.error("Run with --help for usage.");
    process.exitCode = 2;
    return;
  }
  if (options.help) {
    console.log(HELP);
    return;
  }
  if (options.envFile) {
    const result = loadDotEnv({ path: resolve(options.envFile), override: false });
    if (result.error) {
      console.error(`Could not read the environment file: ${resolve(options.envFile)}`);
      process.exitCode = 2;
      return;
    }
  }

  let orgHandle: string;
  let prefix: string;
  try {
    const resolved = await resolveOrgHandle({ explicit: options.orgHandle });
    if (!resolved) {
      throw new TypeError("Organization handle is required. Set CR_ORG_HANDLE or PUBLIC_CONTEXTROCKET_HANDLE, configure contextrocket.handle in config/site.json, or pass --org.");
    }
    orgHandle = normalizeOrgHandle(resolved);
    prefix = normalizeSitePathPrefix(options.pathPrefix);
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Invalid publish target.");
    process.exitCode = 2;
    return;
  }
  const target = `https://${orgHandle}.cdn.contextrocket.com/${prefix ? `${prefix}/` : ""}`;
  let archive;
  try {
    archive = await prepareSiteArchive(options.sourcePath!, { exclude: options.exclude });
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Could not prepare the site archive.");
    process.exitCode = 2;
    return;
  }
  console.log(`target: ${target}`);
  console.log(`files:  ${archive.fileCount}`);
  console.log(`bytes:  ${archive.byteCount.toLocaleString()}`);
  console.log(`tar.gz: ${archive.tarball.byteLength.toLocaleString()}`);
  if (options.dryRun) {
    console.log("dry-run: no upload");
    return;
  }
  const token = process.env.CR_API_TOKEN;
  if (!token?.trim()) {
    console.error("CR_API_TOKEN is required. Load it with --env-file or set it in the environment.");
    process.exitCode = 1;
    return;
  }

  try {
    console.log("uploading site archive…");
    const receipt = await publishPreparedSiteArchive(archive, {
      orgHandle,
      pathPrefix: prefix,
      token,
      apiBase: options.apiBase ?? process.env.CR_API_BASE,
      exclude: options.exclude,
      noWait: options.noWait,
      timeoutMs: options.timeoutSeconds * 1000,
      onStatus: (status, percent) => {
        console.log(`status: ${status}${typeof percent === "number" ? ` (${percent}%)` : ""}`);
      },
    });
    if (receipt.queued) {
      console.log(`queued: release=${receipt.releaseId ?? "unknown"}`);
      console.log(`public: ${receipt.publicUrl}`);
      if (receipt.statusUrl) console.log(`status: ${receipt.statusUrl}`);
    } else {
      console.log(`published: ${receipt.publicUrl}`);
      if (receipt.fileCount !== undefined) console.log(`files: ${receipt.fileCount}`);
      if (receipt.byteCount !== undefined) console.log(`bytes: ${receipt.byteCount.toLocaleString()}`);
    }
  } catch (error) {
    const message =
      error instanceof SitePublisherError
        ? error.message
        : error instanceof Error
          ? error.message
          : "Site publish failed.";
    console.error(`error: ${message.replaceAll(token, "[redacted]")}`);
    process.exitCode = 1;
  }
}

void main();
