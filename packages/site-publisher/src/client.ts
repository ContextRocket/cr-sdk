import { prepareSiteArchive } from "./archive.js";
import type { PreparedSiteArchive } from "./archive.js";

const DEFAULT_API_BASE = "https://api.contextrocket.com";
const HANDLE_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

export interface SitePublicationVisibility {
  indexable: boolean;
  sitemap: boolean;
  noindex: boolean;
}

/** The API validates the complete publication contract and reads built sitemaps. */
export interface SitePublicationManifest {
  publication_id: string;
  kind: "site" | "content" | "page" | "document" | "representation" | "feed" | "dataset";
  canonical_origin: string;
  renderer: { id: string; version?: string | null };
  archive_root?: string;
  routes: readonly {
    public_path: string;
    cdn_path?: string | null;
    mount_type?: "prefix" | "exact" | "proxy";
    sitemap?: string | null;
    visibility?: SitePublicationVisibility | null;
    [key: string]: unknown;
  }[];
  visibility?: SitePublicationVisibility;
  review?: { required: boolean; policy?: "owner" | "editorial" | "compliance" | "operator" | "none" };
  [key: string]: unknown;
}

export interface SitePublishOptions {
  sourcePath: string;
  orgHandle: string;
  token: string;
  apiBase?: string;
  pathPrefix?: string;
  publicationManifest?: SitePublicationManifest;
  /** Approve this generic publication as the authenticated authority; no human review is implied. */
  reviewed?: boolean;
  exclude?: readonly string[];
  noWait?: boolean;
  timeoutMs?: number;
  pollIntervalMs?: number;
  fetcher?: typeof fetch;
  onStatus?: (status: string, percent?: number) => void;
}

export interface SitePublishReceipt {
  orgHandle: string;
  pathPrefix: string;
  publicUrl: string;
  releaseId?: string;
  fileCount?: number;
  byteCount?: number;
  queued: boolean;
  statusUrl?: string;
  tarballBytes: number;
}

export class SitePublisherError extends Error {
  constructor(
    message: string,
    readonly statusCode?: number,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "SitePublisherError";
  }
}

export function normalizeSitePathPrefix(prefix: string | undefined): string {
  const normalized = (prefix ?? "").trim().replace(/^\/+|\/+$/g, "");
  if (!normalized) return "";
  if (
    normalized.includes("\\") ||
    normalized.includes("//") ||
    /[?#\u0000-\u001f\u007f]/.test(normalized) ||
    normalized.split("/").some(
      (part) =>
        !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(part) ||
        part === "." ||
        part === "..",
    ) ||
    normalized.split("/")[0] === "_releases" ||
    normalized.split("/")[0] === "facts"
  ) {
    throw new TypeError("The CDN path prefix contains an unsafe path segment.");
  }
  return normalized;
}

export function normalizeOrgHandle(handle: string): string {
  const orgHandle = handle.trim().replace(/^@/, "").toLowerCase();
  if (!HANDLE_PATTERN.test(orgHandle)) {
    throw new TypeError("A valid organization handle is required.");
  }
  return orgHandle;
}

function resolveApiBase(value: string | undefined): URL {
  let base: URL;
  try {
    base = new URL(value?.trim() || DEFAULT_API_BASE);
  } catch {
    throw new TypeError("The API base must be a valid HTTP or HTTPS URL.");
  }
  if (
    !["https:", "http:"].includes(base.protocol) ||
    base.username ||
    base.password ||
    base.search ||
    base.hash ||
    !["", "/"].includes(base.pathname) ||
    (base.protocol === "http:" &&
      !["localhost", "127.0.0.1", "[::1]"].includes(base.hostname))
  ) {
    throw new TypeError("The API base must be an HTTPS origin, or a loopback HTTP origin for local development.");
  }
  base.pathname = `${base.pathname.replace(/\/+$/, "")}/`;
  return base;
}

function safeApiError(payload: unknown, token: string): string {
  if (!payload || typeof payload !== "object") return "The site publish request failed.";
  const detail = (payload as Record<string, unknown>).detail;
  const candidate =
    typeof detail === "string"
      ? detail
      : detail && typeof detail === "object"
        ? ((detail as Record<string, unknown>).code ??
          (detail as Record<string, unknown>).message)
        : undefined;
  if (typeof candidate !== "string") return "The site publish request failed.";
  return candidate
    .replaceAll(token, "[redacted]")
    .replace(/crk_[A-Za-z0-9_-]+/g, "[redacted]");
}

async function readJson(response: Response): Promise<Record<string, unknown>> {
  const body: unknown = await response.json().catch(() => null);
  return body && typeof body === "object"
    ? (body as Record<string, unknown>)
    : {};
}

function publicUrl(orgHandle: string, pathPrefix: string): string {
  const suffix = pathPrefix ? `/${pathPrefix}/` : "/";
  return `https://${orgHandle}.cdn.contextrocket.com${suffix}`;
}

function statusUrl(value: unknown, apiBase: URL, orgHandle: string): URL {
  if (typeof value !== "string" || !value) {
    throw new SitePublisherError("The publish API returned no release status URL.");
  }
  let result: URL;
  try {
    result = new URL(value, apiBase);
  } catch {
    throw new SitePublisherError("The publish API returned an invalid release status URL.");
  }
  const orgPath = `/api/orgs/${orgHandle}/sites/releases/`;
  if (
    result.origin !== apiBase.origin ||
    result.search ||
    result.hash ||
    !result.pathname.startsWith(orgPath)
  ) {
    throw new SitePublisherError("The publish API returned an unsafe release status URL.");
  }
  return result;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function pollRelease(
  url: URL,
  options: {
    apiBase: URL;
    token: string;
    timeoutMs: number;
    pollIntervalMs: number;
    fetcher: typeof fetch;
    onStatus?: SitePublishOptions["onStatus"];
  },
): Promise<Record<string, unknown>> {
  const deadline = Date.now() + options.timeoutMs;
  let previousStatus = "";
  while (Date.now() < deadline) {
    let response: Response;
    try {
      response = await options.fetcher(url, {
        method: "GET",
        headers: { accept: "application/json", authorization: `Bearer ${options.token}` },
        cache: "no-store",
        redirect: "error",
        signal: AbortSignal.timeout(Math.max(1, Math.min(options.timeoutMs, deadline - Date.now()))),
      });
    } catch (error) {
      throw new SitePublisherError("Could not read the site publish status.", undefined, { cause: error });
    }
    const payload = await readJson(response);
    if (!response.ok) {
      throw new SitePublisherError(
        safeApiError(payload, options.token),
        response.status,
      );
    }
    const status = typeof payload.status === "string" ? payload.status : "unknown";
    const progress = payload.progress;
    const percent =
      progress && typeof progress === "object" &&
      typeof (progress as Record<string, unknown>).percent === "number"
        ? (progress as Record<string, number>).percent
        : undefined;
    if (status !== previousStatus) {
      options.onStatus?.(status, percent);
      previousStatus = status;
    }
    if (status === "live") return payload;
    if (["failed", "unpublished", "expired", "superseded"].includes(status)) {
      const reason = typeof payload.failure_reason === "string" ? `: ${payload.failure_reason}` : "";
      throw new SitePublisherError(`The site release finished as ${status}${reason}.`);
    }
    await delay(Math.min(options.pollIntervalMs, Math.max(0, deadline - Date.now())));
  }
  throw new SitePublisherError(`Timed out waiting for the site release. Check ${url.pathname}.`);
}

export async function publishStaticSite(
  options: SitePublishOptions,
): Promise<SitePublishReceipt> {
  const archive = await prepareSiteArchive(options.sourcePath, { exclude: options.exclude });
  return publishPreparedSiteArchive(archive, options);
}

export async function publishPreparedSiteArchive(
  archive: PreparedSiteArchive,
  options: Omit<SitePublishOptions, "sourcePath">,
): Promise<SitePublishReceipt> {
  const orgHandle = normalizeOrgHandle(options.orgHandle);
  const token = options.token.trim();
  if (!token) throw new TypeError("A private organization machine token is required.");
  const pathPrefix = normalizeSitePathPrefix(options.pathPrefix);
  const apiBase = resolveApiBase(options.apiBase);
  const timeoutMs = options.timeoutMs ?? 600_000;
  const pollIntervalMs = options.pollIntervalMs ?? 2_000;
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new TypeError("The timeout must be a positive number of milliseconds.");
  }
  if (!Number.isFinite(pollIntervalMs) || pollIntervalMs < 0) {
    throw new TypeError("The poll interval must be a non-negative number of milliseconds.");
  }

  const endpoint = new URL(`api/orgs/${orgHandle}/sites/publish`, apiBase);
  const form = new FormData();
  form.set("tarball", new Blob([new Uint8Array(archive.tarball)]), "site.tar.gz");
  form.set("path_prefix", pathPrefix);
  form.set("async", "true");
  if (options.publicationManifest !== undefined) {
    form.set("publication_manifest", JSON.stringify(options.publicationManifest));
    form.set("reviewed", options.reviewed === true ? "true" : "false");
  }

  let response: Response;
  try {
    response = await (options.fetcher ?? fetch)(endpoint, {
      method: "POST",
      headers: { accept: "application/json", authorization: `Bearer ${token}` },
      body: form,
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    throw new SitePublisherError(
      "Could not upload the site archive. The release may still have been queued; check the CDN before retrying.",
      undefined,
      { cause: error },
    );
  }
  const queued = await readJson(response);
  if (!response.ok) {
    throw new SitePublisherError(safeApiError(queued, token), response.status);
  }

  const status = typeof queued.status === "string" ? queued.status : "";
  const releaseId = typeof queued.release_id === "string" ? queued.release_id : undefined;
  const target =
    typeof queued.public_url === "string"
      ? queued.public_url
      : typeof queued.url === "string"
        ? queued.url
        : publicUrl(orgHandle, pathPrefix);
  if (status === "live" || !queued.status_url) {
    return {
      orgHandle,
      pathPrefix,
      publicUrl: target,
      releaseId,
      fileCount: typeof queued.files === "number" ? queued.files : archive.fileCount,
      byteCount: typeof queued.bytes === "number" ? queued.bytes : archive.byteCount,
      queued: false,
      tarballBytes: archive.tarball.byteLength,
    };
  }

  const releaseStatusUrl = statusUrl(queued.status_url, apiBase, orgHandle);
  if (options.noWait) {
    return {
      orgHandle,
      pathPrefix,
      publicUrl: target,
      releaseId,
      fileCount: archive.fileCount,
      byteCount: archive.byteCount,
      queued: true,
      statusUrl: releaseStatusUrl.toString(),
      tarballBytes: archive.tarball.byteLength,
    };
  }

  options.onStatus?.(status || "queued");
  const completed = await pollRelease(releaseStatusUrl, {
    apiBase,
    token,
    timeoutMs,
    pollIntervalMs,
    fetcher: options.fetcher ?? fetch,
    onStatus: options.onStatus,
  });
  return {
    orgHandle,
    pathPrefix,
    publicUrl:
      typeof completed.public_url === "string" ? completed.public_url : target,
    releaseId,
    fileCount: typeof completed.files === "number" ? completed.files : archive.fileCount,
    byteCount: typeof completed.bytes === "number" ? completed.bytes : archive.byteCount,
    queued: false,
    statusUrl: releaseStatusUrl.toString(),
    tarballBytes: archive.tarball.byteLength,
  };
}
