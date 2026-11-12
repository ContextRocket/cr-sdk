/** Public, browser-safe client for an organization's website contact form. */

export type ContactIntent = "contact" | "appointment" | "demo" | "support" | "other";

export type ContactFormJsonValue =
  | string
  | number
  | boolean
  | null
  | ContactFormJsonValue[]
  | { [key: string]: ContactFormJsonValue };

export interface ContactFormData {
  name: string;
  email?: string;
  phone?: string;
  message?: string;
  intent?: ContactIntent;
  source_channel?: string;
  consent: true;
  /** Answers keyed by configured, non-system fields in the org's Leads table. */
  custom_answers?: Record<string, ContactFormJsonValue>;
  source_url?: string;
  referrer_origin?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
}

export interface ContactFormFieldNames {
  name: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  message: string;
  intent: string;
  consent: string;
}

export type ContactFormCustomAnswerType =
  | "text"
  | "number"
  | "boolean"
  | "multi_select";

export interface ContactFormCustomAnswerField {
  /** Native form control name. Repeated checkbox/select values share a name. */
  name: string;
  /** Defaults to text; multi-select and boolean answers should be explicit. */
  type?: ContactFormCustomAnswerType;
}

export interface MapContactFormDataOptions {
  /** HTML field names; empty strings disable optional fields. */
  fields?: Partial<ContactFormFieldNames>;
  /** Used when the form has no intent field, such as a general inquiry. */
  defaultIntent?: ContactIntent;
  /** Site-specific attribution channel, for example "website" or "form". */
  sourceChannel?: string;
  /** Explicitly mapped values keyed by the org's configured Leads field keys. */
  customAnswers?: Record<string, ContactFormJsonValue>;
}

export interface ContactFormReceipt {
  lead_id: string;
  status: "captured";
  delivery_state: "queued" | "duplicate";
  follow_up_state: "human_follow_up";
}

export interface ContactAttribution {
  source_url?: string;
  referrer_origin?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
}

/**
 * Runtime surface exposed by the dependency-free `contact-form.browser.js`
 * artifact on `window.ContextRocketSDK`.
 */
export interface ContextRocketBrowserSDK {
  readonly ContactFormError: typeof ContactFormError;
  readonly createContactFormController: typeof createContactFormController;
  readonly mapContactFormData: typeof mapContactFormData;
  readonly mapCustomContactAnswers: typeof mapCustomContactAnswers;
  readonly extractContactAttribution: typeof extractContactAttribution;
  readonly submitContactForm: typeof submitContactForm;
  readonly submitContactFormWithAttribution: typeof submitContactFormWithAttribution;
}

declare global {
  interface Window {
    /** Present after the static contact-form browser artifact has loaded. */
    ContextRocketSDK?: ContextRocketBrowserSDK;
  }
}

const UTM_KEYS = ["source", "medium", "campaign", "content", "term"] as const;
const CONTACT_INTENTS: readonly ContactIntent[] = [
  "contact",
  "appointment",
  "demo",
  "support",
  "other",
];

const DEFAULT_CONTACT_FIELDS: ContactFormFieldNames = {
  name: "name",
  firstName: "",
  lastName: "",
  email: "email",
  phone: "phone",
  message: "message",
  intent: "intent",
  consent: "consent",
};

function validateCustomAnswers(
  answers: Record<string, ContactFormJsonValue> | undefined,
): Record<string, ContactFormJsonValue> | undefined {
  if (!answers || Object.keys(answers).length === 0) return undefined;
  const entries = Object.entries(answers);
  if (entries.length > 50) {
    throw new TypeError("At most 50 custom contact answers are allowed.");
  }
  for (const [key, value] of entries) {
    if (!key || key.length > 64) {
      throw new TypeError("A custom contact answer key is invalid.");
    }
    const serialized = JSON.stringify(value);
    if (serialized === undefined || serialized.length > 4096) {
      throw new TypeError("A custom contact answer is invalid or too large.");
    }
  }
  if (JSON.stringify(answers).length > 16_384) {
    throw new TypeError("Custom contact answers exceed the allowed size.");
  }
  return answers;
}

function formText(values: FormData, fieldName: string): string {
  if (!fieldName) return "";
  const value = values.get(fieldName);
  return typeof value === "string" ? value.trim() : "";
}

/** Map explicitly configured HTML fields to organization Leads field keys. */
export function mapCustomContactAnswers(
  values: FormData,
  fields: Record<string, ContactFormCustomAnswerField>,
): Record<string, ContactFormJsonValue> {
  const answers: Record<string, ContactFormJsonValue> = {};
  for (const [key, field] of Object.entries(fields)) {
    if (!key || !field.name) {
      throw new TypeError("A custom contact answer field mapping is invalid.");
    }
    const selected = values
      .getAll(field.name)
      .filter((value): value is string => typeof value === "string")
      .map((value) => value.trim())
      .filter(Boolean);
    const type = field.type ?? "text";

    if (type === "boolean") {
      if (selected.length > 1) {
        throw new TypeError(`Boolean contact answer ${key} has multiple values.`);
      }
      const value = selected[0]?.toLowerCase();
      if (value && !["1", "true", "yes", "on", "checked", "0", "false", "no", "off"].includes(value)) {
        throw new TypeError(`Boolean contact answer ${key} is invalid.`);
      }
      answers[key] = value ? !["0", "false", "no", "off"].includes(value) : false;
    } else if (type === "number") {
      if (!selected.length) continue;
      if (selected.length !== 1 || !Number.isFinite(Number(selected[0]))) {
        throw new TypeError(`Numeric contact answer ${key} is invalid.`);
      }
      answers[key] = Number(selected[0]);
    } else if (type === "multi_select") {
      if (selected.length) answers[key] = selected;
    } else if (type === "text") {
      if (!selected.length) continue;
      if (selected.length !== 1) {
        throw new TypeError(`Text contact answer ${key} has multiple values.`);
      }
      answers[key] = selected[0]!;
    } else {
      throw new TypeError(`Custom contact answer ${key} has an unsupported type.`);
    }
  }
  return validateCustomAnswers(answers) ?? {};
}

/**
 * Map native form values to the shared contact API shape. Site markup and
 * validation remain site-owned; this helper only normalizes common fields and
 * refuses to invent the explicit consent required by the API.
 */
export function mapContactFormData(
  values: FormData,
  options: MapContactFormDataOptions = {},
): ContactFormData {
  const customAnswers = validateCustomAnswers(options.customAnswers);
  const fields = { ...DEFAULT_CONTACT_FIELDS, ...options.fields };
  const consent = formText(values, fields.consent).toLowerCase();
  if (!["1", "true", "yes", "on", "checked"].includes(consent)) {
    throw new TypeError("Explicit consent is required.");
  }

  const directName = formText(values, fields.name);
  const splitName = [
    formText(values, fields.firstName),
    formText(values, fields.lastName),
  ]
    .filter(Boolean)
    .join(" ");
  const name = directName || splitName;
  const rawIntent = formText(values, fields.intent);
  if (rawIntent && !CONTACT_INTENTS.includes(rawIntent as ContactIntent)) {
    throw new TypeError("The contact form intent is not supported.");
  }
  const intentValue = rawIntent
    ? (rawIntent as ContactIntent)
    : options.defaultIntent;

  return {
    name,
    email: formText(values, fields.email) || undefined,
    phone: formText(values, fields.phone) || undefined,
    message: formText(values, fields.message) || undefined,
    ...(intentValue ? { intent: intentValue } : {}),
    ...(options.sourceChannel?.trim()
      ? { source_channel: options.sourceChannel.trim() }
      : {}),
    ...(customAnswers ? { custom_answers: customAnswers } : {}),
    consent: true,
  };
}

/**
 * Extract bounded attribution for a contact form without forwarding arbitrary
 * query parameters or fragments (which can contain tokens or personal data).
 */
export function extractContactAttribution(
  pageUrl: string | URL,
  referrerUrl?: string,
): ContactAttribution {
  let page: URL;
  try {
    page = new URL(pageUrl);
  } catch {
    return {};
  }
  if (page.protocol !== "http:" && page.protocol !== "https:") return {};

  const attribution: ContactAttribution = {};
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

export class ContactFormError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
  ) {
    super(message);
    this.name = "ContactFormError";
  }
}

export interface SubmitContactFormOptions {
  apiBaseUrl: string;
  orgHandle: string;
  form: ContactFormData;
  idempotencyKey?: string;
  signal?: AbortSignal;
  fetcher?: typeof fetch;
}

export interface SubmitContactFormWithAttributionOptions
  extends SubmitContactFormOptions {
  /** Current page URL; the SDK strips fragments and all but bounded UTMs. */
  pageUrl: string | URL;
  referrerUrl?: string;
}

export interface ContactFormController {
  /** Submit a form payload, reusing its idempotency key for unchanged retries. */
  submit(options: SubmitContactFormWithAttributionOptions): Promise<ContactFormReceipt>;
  /** Mark the next submission as a new attempt, such as after editing fields. */
  reset(): void;
}

function isContactFormReceipt(payload: unknown): payload is ContactFormReceipt {
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
 * Submit one consented contact form to the org-scoped public capture endpoint.
 * This endpoint does not use a browser API key; the server binds the handle to
 * that organization's lead record and checks the request origin.
 */
export async function submitContactForm({
  apiBaseUrl,
  orgHandle,
  form,
  idempotencyKey,
  signal,
  fetcher = fetch,
}: SubmitContactFormOptions): Promise<ContactFormReceipt> {
  const handle = orgHandle.trim().replace(/^@/, "").toLowerCase();
  if (!handle) throw new TypeError("An organization handle is required.");
  if (!form.consent) throw new TypeError("Explicit consent is required.");
  const customAnswers = validateCustomAnswers(form.custom_answers);

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
      body: JSON.stringify({
        ...form,
        ...(customAnswers ? { custom_answers: customAnswers } : {}),
        org_handle: handle,
      }),
      signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new ContactFormError("The contact form could not be submitted.", 0, "NETWORK_ERROR");
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
    throw new ContactFormError("The contact form could not be submitted.", response.status, code);
  }

  if (!isContactFormReceipt(payload)) {
    throw new ContactFormError("The contact form response was invalid.", response.status, "INVALID_RESPONSE");
  }
  return payload;
}

/**
 * Submit a contact form with first-party page/referrer attribution assembled in one
 * shared path for static forms and framework-specific form components.
 */
export function submitContactFormWithAttribution({
  pageUrl,
  referrerUrl,
  form,
  ...options
}: SubmitContactFormWithAttributionOptions): Promise<ContactFormReceipt> {
  return submitContactForm({
    ...options,
    form: {
      ...form,
      ...extractContactAttribution(pageUrl, referrerUrl),
    },
  });
}

/**
 * Keep form retry behavior consistent across static and framework-specific
 * sites. Failed submissions retain their key; successful or edited attempts
 * receive a fresh key. The controller owns request identity, while each site
 * remains responsible for its form fields and presentation.
 */
export function createContactFormController(
  submitter: typeof submitContactFormWithAttribution = submitContactFormWithAttribution,
  createKey: () => string = () => globalThis.crypto.randomUUID(),
): ContactFormController {
  let pendingFingerprint: string | undefined;
  let pendingKey: string | undefined;
  let inFlight: {
    fingerprint: string;
    promise: Promise<ContactFormReceipt>;
  } | undefined;

  const reset = () => {
    pendingFingerprint = undefined;
    pendingKey = undefined;
  };

  return {
    reset,
    submit(options) {
      const fingerprint = JSON.stringify({
        apiBaseUrl: options.apiBaseUrl,
        orgHandle: options.orgHandle.trim().replace(/^@/, "").toLowerCase(),
        form: options.form,
        pageUrl: String(options.pageUrl),
        referrerUrl: options.referrerUrl,
      });

      if (inFlight?.fingerprint === fingerprint) return inFlight.promise;
      if (pendingFingerprint !== fingerprint || !pendingKey) {
        pendingFingerprint = fingerprint;
        pendingKey = createKey();
      }

      const requestKey = pendingKey;
      const request = submitter({ ...options, idempotencyKey: requestKey }).then(
        (receipt) => {
          if (pendingKey === requestKey) reset();
          return receipt;
        },
      );
      const current = { fingerprint, promise: request };
      inFlight = current;
      void request.finally(() => {
        if (inFlight === current) inFlight = undefined;
      }).catch(() => undefined);
      return request;
    },
  };
}
