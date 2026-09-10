/**
 * Configuration resolution for createCRClient.
 *
 * Env vars (Next NEXT_PUBLIC_* or Astro PUBLIC_*):
 *   CR_AGENT_URL / CONTEXTROCKET_HANDLE / CONTEXTROCKET_API_KEY
 *   BACKEND_ENABLED / BACKEND_URL (auth starters only)
 */

export interface CRConfig {
  /** Base URL of the ContextRocket A2A agent endpoint. */
  agentUrl: string;
  /** Public organization handle for anonymous browser A2A. */
  handle: string | undefined;
  /** Publishable website API key; never a server-side secret. */
  apiKey: string | undefined;
  /** Whether the local fastapi-users backend is enabled. */
  backendEnabled: boolean;
  /** Base URL of the local backend (used for guest auth, user management). */
  backendUrl: string;
}

const DEFAULT_BACKEND_URL = "http://localhost:8100";

function env(name: string): string | undefined {
  if (typeof process === "undefined") return undefined;
  return process.env[name];
}

/** Read Next (NEXT_PUBLIC_*) or Astro (PUBLIC_*) env names. */
function publicEnv(...names: string[]): string | undefined {
  for (const name of names) {
    const value = env(name);
    if (value) return value;
  }
  return undefined;
}

/**
 * Resolve the CR config from environment variables.
 * Safe to call at module scope or inside a component.
 */
export function resolveCRConfig(): CRConfig {
  const agentUrl =
    publicEnv("NEXT_PUBLIC_CR_AGENT_URL", "PUBLIC_CR_AGENT_URL") ||
    "https://app-api.contextrocket.com";
  const handle =
    publicEnv(
      "NEXT_PUBLIC_CONTEXTROCKET_HANDLE",
      "PUBLIC_CONTEXTROCKET_HANDLE",
    ) || "contextrocket";
  const apiKey = publicEnv(
    "NEXT_PUBLIC_CONTEXTROCKET_API_KEY",
    "PUBLIC_CONTEXTROCKET_API_KEY",
  );
  const backendEnabled =
    publicEnv("NEXT_PUBLIC_BACKEND_ENABLED", "PUBLIC_BACKEND_ENABLED") ===
    "true";
  const backendUrl =
    publicEnv("NEXT_PUBLIC_BACKEND_URL", "PUBLIC_BACKEND_URL") ||
    DEFAULT_BACKEND_URL;

  return {
    agentUrl: agentUrl.replace(/\/$/, ""),
    handle: handle || undefined,
    apiKey: apiKey || undefined,
    backendEnabled,
    backendUrl: backendUrl.replace(/\/$/, ""),
  };
}
