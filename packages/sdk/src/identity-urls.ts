import type { CRSubjectKind } from "./config.js";

/** Typed resources available below a ContextRocket company or person URL. */
export type ContextRocketIdentityResource =
  | "mcp"
  | "a2a"
  | "agent-card.json";

/** Build a tenant-selecting API path from its authoritative identity kind. */
export function contextRocketIdentityPath(
  subjectKind: CRSubjectKind,
  handle: string,
  resource: ContextRocketIdentityResource,
): string {
  if (!handle.trim()) throw new TypeError("A ContextRocket handle is required.");
  return `/${subjectKind}/${encodeURIComponent(handle)}/${resource}`;
}

/** Build a canonical typed API URL for a configured ContextRocket identity. */
export function contextRocketIdentityUrl(
  apiBaseUrl: string,
  subjectKind: CRSubjectKind,
  handle: string,
  resource: ContextRocketIdentityResource,
): string {
  return `${apiBaseUrl.replace(/\/+$/, "")}${contextRocketIdentityPath(subjectKind, handle, resource)}`;
}
