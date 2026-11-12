import { describe, expect, it, vi } from "vitest";
import {
  createContactFormController,
  ContactFormError,
  mapContactFormData,
  submitContactForm,
  submitContactFormWithAttribution,
} from "./contact-form.js";

describe("submitContactForm", () => {
  it("sends a consented lead to the org-scoped endpoint with a retry identity", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({
      lead_id: "lead-1",
      status: "captured",
      delivery_state: "queued",
      follow_up_state: "human_follow_up",
    }), { status: 201, headers: { "content-type": "application/json" } }));

    const receipt = await submitContactForm({
      apiBaseUrl: "https://api.contextrocket.com/",
      orgHandle: "@Kleos",
      idempotencyKey: "request-1",
      form: { name: "Ada Lovelace", email: "ada@example.com", intent: "appointment", consent: true },
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

    await expect(submitContactForm({
      apiBaseUrl: "https://api.contextrocket.com",
      orgHandle: "kleos",
      form: { name: "Ada", consent: true },
      fetcher,
    })).rejects.toMatchObject<Partial<ContactFormError>>({
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

    await expect(submitContactForm({
      apiBaseUrl: "https://api.contextrocket.com",
      orgHandle: "kleos",
      form: { name: "Ada", consent: true },
      fetcher,
    })).rejects.toMatchObject<Partial<ContactFormError>>({
      status: 201,
      code: "INVALID_RESPONSE",
    });
  });

  it("requires organization binding and consent before making a request", async () => {
    const fetcher = vi.fn<typeof fetch>();
    await expect(submitContactForm({
      apiBaseUrl: "https://api.contextrocket.com",
      orgHandle: " ",
      form: { name: "Ada", consent: true },
      fetcher,
    })).rejects.toThrow(/organization handle/);
    await expect(submitContactForm({
      apiBaseUrl: "https://api.contextrocket.com",
      orgHandle: "kleos",
      form: { name: "Ada", consent: false as true },
      fetcher,
    })).rejects.toThrow(/consent/);
    expect(fetcher).not.toHaveBeenCalled();
  });
});

describe("mapContactFormData", () => {
  it("maps and trims standard fields while preserving selected consent", () => {
    const values = new FormData();
    values.set("name", " Ada Lovelace ");
    values.set("email", " ada@example.com ");
    values.set("phone", " +44 20 0000 0000 ");
    values.set("intent", "appointment");
    values.set("message", " Please call me. ");
    values.set("consent", "on");

    expect(mapContactFormData(values, { sourceChannel: " website " })).toEqual({
      name: "Ada Lovelace",
      email: "ada@example.com",
      phone: "+44 20 0000 0000",
      intent: "appointment",
      message: "Please call me.",
      source_channel: "website",
      consent: true,
    });
  });

  it("supports mapped split-name fields and a default intent", () => {
    const values = new FormData();
    values.set("first-name", "Ada");
    values.set("last-name", "Lovelace");
    values.set("your-email", "ada@example.com");
    values.set("consent", "1");

    expect(
      mapContactFormData(values, {
        fields: {
          name: "",
          firstName: "first-name",
          lastName: "last-name",
          email: "your-email",
          phone: "",
          message: "",
          intent: "",
        },
        defaultIntent: "contact",
      }),
    ).toEqual({
      name: "Ada Lovelace",
      email: "ada@example.com",
      phone: undefined,
      message: undefined,
      intent: "contact",
      consent: true,
    });
  });

  it("does not infer consent or silently accept unsupported intents", () => {
    const unchecked = new FormData();
    unchecked.set("name", "Ada");
    expect(() => mapContactFormData(unchecked)).toThrow(/consent/i);

    const invalidIntent = new FormData();
    invalidIntent.set("name", "Ada");
    invalidIntent.set("intent", "immigration-advice");
    invalidIntent.set("consent", "yes");
    expect(() => mapContactFormData(invalidIntent)).toThrow(/intent/i);
  });
});

describe("submitContactFormWithAttribution", () => {
  it("attaches safe page and referrer attribution before submission", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({
      lead_id: "lead-2",
      status: "captured",
      delivery_state: "queued",
      follow_up_state: "human_follow_up",
    }), { status: 201, headers: { "content-type": "application/json" } }));

    await submitContactFormWithAttribution({
      apiBaseUrl: "https://api.contextrocket.com",
      orgHandle: "kleos",
      pageUrl: "https://kleos.example/contact?utm_source=linkedin&token=secret#form",
      referrerUrl: "https://search.example/query?q=private",
      form: { name: "Ada", intent: "appointment", consent: true },
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

describe("createContactFormController", () => {
  const options = {
    apiBaseUrl: "https://api.contextrocket.com",
    orgHandle: "kleos",
    pageUrl: "https://kleos.example/contact",
    form: { name: "Ada", email: "ada@example.com", consent: true as const },
  };
  const receipt = {
    lead_id: "lead-1",
    status: "captured" as const,
    delivery_state: "queued" as const,
    follow_up_state: "human_follow_up" as const,
  };

  it("reuses a retry key after failure and rotates it when the payload changes", async () => {
    const submitter = vi.fn<typeof submitContactFormWithAttribution>()
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValue(receipt);
    const controller = createContactFormController(
      submitter,
      vi.fn().mockReturnValueOnce("key-1").mockReturnValueOnce("key-2"),
    );

    await expect(controller.submit(options)).rejects.toThrow("network");
    await controller.submit(options);
    await controller.submit({ ...options, form: { ...options.form, name: "Ada Byron" } });

    expect(submitter.mock.calls.map(([request]) => request.idempotencyKey)).toEqual([
      "key-1", "key-1", "key-2",
    ]);
  });

  it("shares a concurrent unchanged request and starts a fresh attempt after success", async () => {
    let resolveRequest!: (value: typeof receipt) => void;
    const submitter = vi.fn<typeof submitContactFormWithAttribution>(() => new Promise<typeof receipt>((resolve) => {
      resolveRequest = resolve;
    }));
    const controller = createContactFormController(
      submitter,
      vi.fn().mockReturnValueOnce("key-1").mockReturnValueOnce("key-2"),
    );

    const first = controller.submit(options);
    const duplicate = controller.submit(options);
    expect(duplicate).toBe(first);
    resolveRequest(receipt);
    await first;
    const next = controller.submit(options);
    resolveRequest(receipt);
    await next;

    expect(submitter.mock.calls.map(([request]) => request.idempotencyKey)).toEqual([
      "key-1", "key-2",
    ]);
  });
});
