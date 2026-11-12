import type { CRSubjectKind } from "./config.js";

const DEFAULT_CONTEXTROCKET_WEB_ORIGIN = "https://contextrocket.com";

/** Typed resources available below a ContextRocket company or person URL. */
export type CRIdentityResource =
  | "mcp"
  | "a2a"
  | "agent-card.json";

/** Build a tenant-selecting API path from its authoritative identity kind. */
export function crIdentityPath(
  subjectKind: CRSubjectKind,
  handle: string,
  resource: CRIdentityResource,
): string {
  if (!handle.trim()) throw new TypeError("A ContextRocket handle is required.");
  return `/${subjectKind}/${encodeURIComponent(handle)}/${resource}`;
}

/** Build a canonical typed API URL for a configured ContextRocket identity. */
export function crIdentityUrl(
  apiBaseUrl: string,
  subjectKind: CRSubjectKind,
  handle: string,
  resource: CRIdentityResource,
): string {
  return `${apiBaseUrl.replace(/\/+$/, "")}${crIdentityPath(subjectKind, handle, resource)}`;
}

/**
 * Build the public Grounding Page URL for a company or person identity.
 *
 * `webOrigin` may be a verified customer domain that preserves the typed
 * identity path through a reverse proxy. This is a web URL, not an API URL.
 */
export function crGroundingPageUrl(
  subjectKind: CRSubjectKind,
  handle: string,
  webOrigin: string = DEFAULT_CONTEXTROCKET_WEB_ORIGIN,
): string {
  if (!handle.trim()) throw new TypeError("A ContextRocket handle is required.");
  const base = webOrigin.replace(/\/+$/, "");
  return `${base}/${subjectKind}/${encodeURIComponent(handle)}/facts`;
}
