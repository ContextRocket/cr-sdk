/** Public, browser-safe client for an organization's website lead form. */

export type LeadIntent = "contact" | "appointment" | "demo" | "support" | "other";

export interface PublicLeadInput {
  name: string;
  email?: string;
  phone?: string;
  message?: string;
  intent?: LeadIntent;
  source_channel?: string;
  consent: true;
  source_url?: string;
  referrer_origin?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
}

export interface PublicLeadReceipt {
  lead_id: string;
  status: "captured";
  delivery_state: "queued" | "duplicate";
  follow_up_state: "human_follow_up";
}

export interface PublicLeadAttribution {
  source_url?: string;
  referrer_origin?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
}

const UTM_KEYS = ["source", "medium", "campaign", "content", "term"] as const;

/**
 * Extract bounded attribution for a public lead without forwarding arbitrary
 * query parameters or fragments (which can contain tokens or personal data).
 */
export function extractLeadAttribution(
  pageUrl: string | URL,
  referrerUrl?: string,
): PublicLeadAttribution {
  let page: URL;
  try {
    page = new URL(pageUrl);
  } catch {
    return {};
  }
  if (page.protocol !== "http:" && page.protocol !== "https:") return {};

  const attribution: PublicLeadAttribution = {};
  const sourceUrl = `${page.origin}${page.pathname}`;
  if (sourceUrl.length <= 2048) attribution.source_url = sourceUrl;

  if (referrerUrl) {
    try {
      const referrer = new URL(referrerUrl);
      if (
        (referrer.protocol === "http:" || referrer.protocol === "https:") &&
        referrer.origin.length <= 2048
      ) {
        attribution.referrer_origin = referrer.origin;
      }
    } catch {
      // Invalid or non-URL referrers are omitted from attribution.
    }
  }

  for (const key of UTM_KEYS) {
    const value = page.searchParams.get(`utm_${key}`)?.trim().slice(0, 128);
    if (value) attribution[`utm_${key}`] = value;
  }
  return attribution;
}

export class LeadCaptureError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
  ) {
    super(message);
    this.name = "LeadCaptureError";
  }
}

export interface SubmitPublicLeadOptions {
  apiBaseUrl: string;
  orgHandle: string;
  lead: PublicLeadInput;
  idempotencyKey?: string;
  signal?: AbortSignal;
  fetcher?: typeof fetch;
}

export interface SubmitPublicLeadWithAttributionOptions
  extends SubmitPublicLeadOptions {
  /** Current page URL; the SDK strips fragments and all but bounded UTMs. */
  pageUrl: string | URL;
  referrerUrl?: string;
}

function isPublicLeadReceipt(payload: unknown): payload is PublicLeadReceipt {
  if (!payload || typeof payload !== "object") return false;
  const receipt = payload as Record<string, unknown>;
  return (
    typeof receipt.lead_id === "string" &&
    receipt.lead_id.trim().length > 0 &&
    receipt.status === "captured" &&
    (receipt.delivery_state === "queued" || receipt.delivery_state === "duplicate") &&
    receipt.follow_up_state === "human_follow_up"
  );
}

/**
 * Submit one consented lead to the org-scoped public capture endpoint.
 * This endpoint does not use a browser API key; the server binds the handle to
 * that organization's canonical Lead Capture App and checks the request origin.
 */
export async function submitPublicLead({
  apiBaseUrl,
  orgHandle,
  lead,
  idempotencyKey,
  signal,
  fetcher = fetch,
}: SubmitPublicLeadOptions): Promise<PublicLeadReceipt> {
  const handle = orgHandle.trim().replace(/^@/, "").toLowerCase();
  if (!handle) throw new TypeError("An organization handle is required.");
  if (!lead.consent) throw new TypeError("Explicit consent is required.");

  const endpoint = new URL("/api/apps/leads/capture", apiBaseUrl);
  endpoint.searchParams.set("org_handle", handle);
  const headers = new Headers({
    accept: "application/json",
    "content-type": "application/json",
  });
  if (idempotencyKey) headers.set("idempotency-key", idempotencyKey);

  let response: Response;
  try {
    response = await fetcher(endpoint, {
      method: "POST",
      mode: "cors",
      credentials: "omit",
      cache: "no-store",
      headers,
      body: JSON.stringify({ ...lead, org_handle: handle }),
      signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new LeadCaptureError("The lead could not be submitted.", 0, "NETWORK_ERROR");
  }

  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = payload && typeof payload === "object"
      ? (payload as Record<string, unknown>).detail
      : undefined;
    const code = typeof detail === "string"
      ? detail
      : detail && typeof detail === "object" && typeof (detail as Record<string, unknown>).code === "string"
        ? String((detail as Record<string, unknown>).code)
        : "LEAD_CAPTURE_FAILED";
    throw new LeadCaptureError("The lead could not be submitted.", response.status, code);
  }

  if (!isPublicLeadReceipt(payload)) {
    throw new LeadCaptureError("The lead response was invalid.", response.status, "INVALID_RESPONSE");
  }
  return payload;
}

/**
 * Submit a lead with first-party page/referrer attribution assembled in one
 * shared path for static forms and framework-specific form components.
 */
export function submitPublicLeadWithAttribution({
  pageUrl,
  referrerUrl,
  lead,
  ...options
}: SubmitPublicLeadWithAttributionOptions): Promise<PublicLeadReceipt> {
  return submitPublicLead({
    ...options,
    lead: {
      ...lead,
      ...extractLeadAttribution(pageUrl, referrerUrl),
    },
  });
}
