import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { resolveOrgHandle } from "./config.js";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function makeRoot(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "cr-site-config-"));
  roots.push(root);
  return root;
}

describe("resolveOrgHandle", () => {
  it("uses explicit then environment overrides before the starter config", async () => {
    const cwd = await makeRoot();
    await mkdir(path.join(cwd, "config"));
    await writeFile(path.join(cwd, "config/site.json"), JSON.stringify({ contextrocket: { handle: "starter" } }));

    await expect(resolveOrgHandle({ explicit: "explicit", env: { CR_ORG_HANDLE: "env" }, cwd })).resolves.toBe("explicit");
    await expect(resolveOrgHandle({ env: { CR_ORG_HANDLE: "env", PUBLIC_CONTEXTROCKET_HANDLE: "public" }, cwd })).resolves.toBe("env");
    await expect(resolveOrgHandle({ env: {}, cwd })).resolves.toBe("starter");
  });

  it("returns undefined when no supported handle is configured", async () => {
    await expect(resolveOrgHandle({ env: {}, cwd: await makeRoot() })).resolves.toBeUndefined();
  });
});
