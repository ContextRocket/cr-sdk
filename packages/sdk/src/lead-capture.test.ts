import { describe, expect, it, vi } from "vitest";
import {
  LeadCaptureError,
  submitPublicLead,
  submitPublicLeadWithAttribution,
} from "./lead-capture.js";

describe("submitPublicLead", () => {
  it("sends a consented lead to the org-scoped endpoint with a retry identity", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({
      lead_id: "lead-1",
      status: "captured",
      delivery_state: "queued",
      follow_up_state: "human_follow_up",
    }), { status: 201, headers: { "content-type": "application/json" } }));

    const receipt = await submitPublicLead({
      apiBaseUrl: "https://api.contextrocket.com/",
      orgHandle: "@Kleos",
      idempotencyKey: "request-1",
      lead: { name: "Ada Lovelace", email: "ada@example.com", intent: "appointment", consent: true },
      fetcher,
    });

    expect(receipt.lead_id).toBe("lead-1");
    const [request, init] = fetcher.mock.calls[0]!;
    expect(String(request)).toBe("https://api.contextrocket.com/api/apps/leads/capture?org_handle=kleos");
    expect(init?.method).toBe("POST");
    expect(init?.mode).toBe("cors");
    expect(init?.credentials).toBe("omit");
    expect(new Headers(init?.headers).get("idempotency-key")).toBe("request-1");
    expect(JSON.parse(String(init?.body))).toMatchObject({
      org_handle: "kleos",
      intent: "appointment",
      consent: true,
    });
  });

  it("surfaces stable API error codes without exposing server detail text", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ detail: "ERROR_MARKETING_DISABLED" }), {
      status: 403,
      headers: { "content-type": "application/json" },
    }));

    await expect(submitPublicLead({
      apiBaseUrl: "https://api.contextrocket.com",
      orgHandle: "kleos",
      lead: { name: "Ada", consent: true },
      fetcher,
    })).rejects.toMatchObject<Partial<LeadCaptureError>>({
      status: 403,
      code: "ERROR_MARKETING_DISABLED",
    });
  });

  it("rejects a success response that does not satisfy the receipt contract", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({
      lead_id: "lead-1",
      status: "captured",
      delivery_state: "sent",
      follow_up_state: "human_follow_up",
    }), { status: 201, headers: { "content-type": "application/json" } }));

    await expect(submitPublicLead({
      apiBaseUrl: "https://api.contextrocket.com",
      orgHandle: "kleos",
      lead: { name: "Ada", consent: true },
      fetcher,
    })).rejects.toMatchObject<Partial<LeadCaptureError>>({
      status: 201,
      code: "INVALID_RESPONSE",
    });
  });

  it("requires organization binding and consent before making a request", async () => {
    const fetcher = vi.fn<typeof fetch>();
    await expect(submitPublicLead({
      apiBaseUrl: "https://api.contextrocket.com",
      orgHandle: " ",
      lead: { name: "Ada", consent: true },
      fetcher,
    })).rejects.toThrow(/organization handle/);
    await expect(submitPublicLead({
      apiBaseUrl: "https://api.contextrocket.com",
      orgHandle: "kleos",
      lead: { name: "Ada", consent: false as true },
      fetcher,
    })).rejects.toThrow(/consent/);
    expect(fetcher).not.toHaveBeenCalled();
  });
});

describe("submitPublicLeadWithAttribution", () => {
  it("attaches safe page and referrer attribution before submission", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({
      lead_id: "lead-2",
      status: "captured",
      delivery_state: "queued",
      follow_up_state: "human_follow_up",
    }), { status: 201, headers: { "content-type": "application/json" } }));

    await submitPublicLeadWithAttribution({
      apiBaseUrl: "https://api.contextrocket.com",
      orgHandle: "kleos",
      pageUrl: "https://kleos.example/contact?utm_source=linkedin&token=secret#form",
      referrerUrl: "https://search.example/query?q=private",
      lead: { name: "Ada", intent: "appointment", consent: true },
      fetcher,
    });

    const [, init] = fetcher.mock.calls[0]!;
    expect(JSON.parse(String(init?.body))).toMatchObject({
      source_url: "https://kleos.example/contact",
      referrer_origin: "https://search.example",
      utm_source: "linkedin",
    });
    expect(String(init?.body)).not.toContain("secret");
    expect(String(init?.body)).not.toContain("private");
  });
});
