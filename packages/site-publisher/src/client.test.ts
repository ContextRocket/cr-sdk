import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  normalizeOrgHandle,
  normalizeSitePathPrefix,
  publishStaticSite,
  SitePublisherError,
} from "./client.js";

const temporaryDirectories: string[] = [];

async function siteDirectory(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "cr-site-client-"));
  temporaryDirectories.push(root);
  await writeFile(path.join(root, "index.html"), "<h1>Published</h1>");
  return root;
}

afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(temporaryDirectories.splice(0).map((directory) =>
    rm(directory, { recursive: true, force: true }),
  ));
});

describe("publish target normalization", () => {
  it("normalizes organization handles and path prefixes", () => {
    expect(normalizeOrgHandle("@Kleos")).toBe("kleos");
    expect(normalizeSitePathPrefix("/blog/posts/")).toBe("blog/posts");
    expect(normalizeSitePathPrefix(undefined)).toBe("");
  });

  it.each(["a//b", "../root", "_releases", "facts", "with space", "x/" + "a".repeat(129)])(
    "rejects unsafe path prefix %s",
    (prefix) => expect(() => normalizeSitePathPrefix(prefix)).toThrow(/unsafe/),
  );
  it("rejects malformed org handles", () => {
    expect(() => normalizeOrgHandle("Not a handle")).toThrow(/organization handle/);
  });

  it("only permits HTTPS API endpoints except for loopback local development", async () => {
    const sourcePath = await siteDirectory();
    const fetcher: typeof fetch = vi.fn();
    await expect(publishStaticSite({
      sourcePath,
      orgHandle: "example",
      token: "crk_test",
      apiBase: "http://api.example.test",
      fetcher,
    })).rejects.toThrow(/HTTPS origin/);
    await expect(publishStaticSite({
      sourcePath,
      orgHandle: "example",
      token: "crk_test",
      apiBase: "https://api.example.test/prefix",
      fetcher,
    })).rejects.toThrow(/HTTPS origin/);
    expect(fetcher).not.toHaveBeenCalled();
  });
});

describe("publishStaticSite", () => {
  it("uploads a multipart archive with private bearer auth and polls the org release", async () => {
    const sourcePath = await siteDirectory();
    await writeFile(path.join(sourcePath, "sitemap.xml"),
      '<urlset><url><loc>https://example.test/blog/podcast</loc></url></urlset>');
    const publicationManifest = {
      publication_id: "example-site",
      kind: "site" as const,
      canonical_origin: "https://example.test",
      renderer: { id: "static" },
      routes: [{ public_path: "/blog", cdn_path: "blog", sitemap: "/blog/sitemap.xml" }],
      visibility: { indexable: true, sitemap: true, noindex: false },
      review: { required: true },
    };
    const calls: Array<{ url: URL; init: RequestInit }> = [];
    const fetcher: typeof fetch = vi.fn(async (input, init = {}) => {
      const url = input instanceof URL ? input : new URL(String(input));
      calls.push({ url, init });
      if (init.method === "POST") {
        expect(new Headers(init.headers).get("authorization")).toBe("Bearer crk_private-test");
        expect(init.body).toBeInstanceOf(FormData);
        const form = init.body as FormData;
        expect(form.get("path_prefix")).toBe("blog");
        expect(form.get("async")).toBe("true");
        expect(JSON.parse(String(form.get("publication_manifest")))).toEqual(publicationManifest);
        expect(form.get("reviewed")).toBe("true");
        expect(form.get("tarball")).toBeInstanceOf(Blob);
        return Response.json({
          release_id: "release-1",
          status: "building",
          status_url: "/api/orgs/kleos/sites/releases/release-1",
          public_url: "https://kleos.cdn.contextrocket.com/blog/",
        }, { status: 202 });
      }
      return Response.json({
        release_id: "release-1",
        status: "live",
        public_url: "https://kleos.cdn.contextrocket.com/blog/",
        files: 1,
        bytes: 17,
        progress: { percent: 100 },
      });
    });

    const receipt = await publishStaticSite({
      sourcePath,
      orgHandle: "Kleos",
      pathPrefix: "blog",
      publicationManifest,
      reviewed: true,
      apiBase: "https://api.example.test",
      token: "crk_private-test",
      fetcher,
      timeoutMs: 1000,
      pollIntervalMs: 0,
    });

    expect(calls).toHaveLength(2);
    expect(calls[0].url.pathname).toBe("/api/orgs/kleos/sites/publish");
    expect(calls[1].url.pathname).toBe("/api/orgs/kleos/sites/releases/release-1");
    expect(receipt).toMatchObject({
      orgHandle: "kleos",
      pathPrefix: "blog",
      publicUrl: "https://kleos.cdn.contextrocket.com/blog/",
      releaseId: "release-1",
      fileCount: 1,
      byteCount: 17,
      queued: false,
    });
  });

  it("returns a safe status URL without polling when noWait is enabled", async () => {
    const sourcePath = await siteDirectory();
    const fetcher: typeof fetch = vi.fn(async () => Response.json({
      release_id: "release-2",
      status: "building",
      status_url: "/api/orgs/example/sites/releases/release-2",
      public_url: "https://example.cdn.contextrocket.com/",
    }, { status: 202 }));

    const receipt = await publishStaticSite({
      sourcePath,
      orgHandle: "example",
      token: "crk_test",
      apiBase: "https://api.example.test",
      fetcher,
      noWait: true,
    });

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(receipt.queued).toBe(true);
    expect(receipt.statusUrl).toBe("https://api.example.test/api/orgs/example/sites/releases/release-2");
  });

  it("rejects status URLs that could send the private token to another origin", async () => {
    const sourcePath = await siteDirectory();
    const fetcher: typeof fetch = vi.fn(async () => Response.json({
      release_id: "release-3",
      status: "building",
      status_url: "https://attacker.example/collect",
    }, { status: 202 }));

    await expect(publishStaticSite({
      sourcePath,
      orgHandle: "example",
      token: "crk_private-test",
      apiBase: "https://api.example.test",
      fetcher,
    })).rejects.toThrow(/unsafe release status URL/);
  });

  it("reports API errors without echoing private credentials", async () => {
    const sourcePath = await siteDirectory();
    const token = "crk_sensitive-value";
    const fetcher: typeof fetch = vi.fn(async () => Response.json({
      detail: `bad credential ${token}`,
    }, { status: 401 }));

    let caught: unknown;
    try {
      await publishStaticSite({
        sourcePath,
        orgHandle: "example",
        token,
        apiBase: "https://api.example.test",
        fetcher,
      });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(SitePublisherError);
    expect((caught as Error).message).not.toContain(token);
    expect((caught as Error).message).toContain("[redacted]");
    expect((caught as SitePublisherError).statusCode).toBe(401);
  });
});
