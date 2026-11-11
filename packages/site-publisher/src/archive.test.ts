import { mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { gunzipSync } from "node:zlib";
import { afterEach, describe, expect, it } from "vitest";
import { prepareSiteArchive } from "./archive.js";

const temporaryDirectories: string[] = [];

async function siteDirectory(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "cr-site-publisher-"));
  temporaryDirectories.push(root);
  await mkdir(path.join(root, "assets"));
  await writeFile(path.join(root, "index.html"), "<h1>Hello</h1>");
  await writeFile(path.join(root, "assets", "site.css"), "body { color: black }");
  await mkdir(path.join(root, ".git"));
  await writeFile(path.join(root, ".git", "config"), "do not publish");
  await writeFile(path.join(root, "debug.js.map"), "excluded map");
  return root;
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) =>
    rm(directory, { recursive: true, force: true }),
  ));
});

describe("prepareSiteArchive", () => {
  it("keeps static files, excludes repository internals, and creates deterministic tar.gz bytes", async () => {
    const root = await siteDirectory();
    const first = await prepareSiteArchive(root, { exclude: ["*.map"] });
    const second = await prepareSiteArchive(root, { exclude: ["*.map"] });
    const tar = gunzipSync(first.tarball);

    expect(first.filePaths).toEqual([
      "assets/site.css",
      "index.html",
    ]);
    expect(first.fileCount).toBe(2);
    expect(first.byteCount).toBe(Buffer.byteLength("body { color: black }") + Buffer.byteLength("<h1>Hello</h1>"));
    expect(first.tarball.equals(second.tarball)).toBe(true);
    expect(tar.includes(Buffer.from("assets/site.css"))).toBe(true);
    expect(tar.includes(Buffer.from("index.html"))).toBe(true);
    expect(tar.includes(Buffer.from("do not publish"))).toBe(false);
  });

  it("rejects symbolic links so a site build cannot archive files outside its root", async () => {
    const root = await siteDirectory();
    const outside = path.join(root, "secret.txt");
    await writeFile(outside, "private");
    await symlink(outside, path.join(root, "assets", "external.txt"));

    await expect(prepareSiteArchive(root)).rejects.toThrow(/symbolic links/);
  });

  it("fails if exclusions remove every file", async () => {
    const root = await siteDirectory();
    await expect(prepareSiteArchive(root, { exclude: ["**"] })).rejects.toThrow(/No site files/);
  });
});
