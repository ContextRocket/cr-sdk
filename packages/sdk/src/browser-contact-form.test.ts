import { buildSync } from "esbuild";
import { runInNewContext } from "node:vm";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import type { ContextRocketBrowserSDK } from "./contact-form.js";

describe("static browser contact-form bridge", () => {
  it("installs a read-only browser API that uses the tested org-scoped client", async () => {
    const bundle = buildSync({
      entryPoints: [fileURLToPath(new URL("./browser-contact-form.ts", import.meta.url))],
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
      contact_id: "contact-bridge-1",
      status: "captured",
      delivery_state: "queued",
      follow_up_state: "human_follow_up",
    }), { status: 201, headers: { "content-type": "application/json" } }));

    const values = new FormData();
    values.set("linkedin-url", "https://example.com/in/visitor?view=full#bio");
    const customAnswers = api!.mapCustomContactAnswers(values, {
      profile_url: { name: "linkedin-url", type: "url" },
    });
    const receipt = await api!.submitContactForm({
      apiBaseUrl: "https://api.contextrocket.com",
      orgHandle: "Kleos",
      form: { name: "Ada Lovelace", consent: true, custom_answers: customAnswers },
      fetcher,
    });

    expect(receipt.contact_id).toBe("contact-bridge-1");
    expect(JSON.parse(String(fetcher.mock.calls[0]?.[1]?.body)).custom_answers).toEqual({
      profile_url: "https://example.com/in/visitor?view=full#bio",
    });
    expect(String(fetcher.mock.calls[0]?.[0])).toBe("https://api.contextrocket.com/api/orgs/kleos/contacts");
  });
});
