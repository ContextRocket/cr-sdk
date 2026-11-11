import { buildSync } from "esbuild";
import { runInNewContext } from "node:vm";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import type { ContextRocketBrowserSDK } from "./lead-capture.js";

describe("static browser lead-capture bridge", () => {
  it("installs a read-only browser API that uses the tested org-scoped client", async () => {
    const bundle = buildSync({
      entryPoints: [fileURLToPath(new URL("./browser-lead-capture.ts", import.meta.url))],
      bundle: true,
      write: false,
      format: "iife",
      platform: "browser",
      target: "es2020",
      legalComments: "none",
    }).outputFiles[0]!.text;
    const sandbox: Record<string, unknown> = { URL, Headers };
    runInNewContext(bundle, sandbox);

    const api = sandbox.ContextRocketSDK as ContextRocketBrowserSDK | undefined;
    expect(api).toBeDefined();
    expect(Object.isFrozen(api)).toBe(true);
    expect(Object.getOwnPropertyDescriptor(sandbox, "ContextRocketSDK")).toMatchObject({
      configurable: false,
      enumerable: false,
      writable: false,
    });

    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({
      lead_id: "lead-bridge-1",
      status: "captured",
      delivery_state: "queued",
      follow_up_state: "human_follow_up",
    }), { status: 201, headers: { "content-type": "application/json" } }));

    const receipt = await api!.submitPublicLead({
      apiBaseUrl: "https://api.contextrocket.com",
      orgHandle: "Kleos",
      lead: { name: "Ada Lovelace", consent: true },
      fetcher,
    });

    expect(receipt.lead_id).toBe("lead-bridge-1");
    expect(String(fetcher.mock.calls[0]?.[0])).toContain("org_handle=kleos");
  });
});
