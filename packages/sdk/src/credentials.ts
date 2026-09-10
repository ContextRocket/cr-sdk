/**
 * cr-sdk -- credential management.
 *
 * Handles guest session lifecycle: provisioning a guest JWT from the local
 * fastapi-users backend (POST /auth/guest) and storing it alongside a regular
 * login token.  The stored token is passed as the Bearer credential on A2A
 * calls so the ContextRocket backend can bind the session.
 *
 * Storage: localStorage under CR_AUTH_TOKEN_KEY.  Falls back to in-memory
 * when localStorage is unavailable (SSR, test environments).
 *
 * Origin: clean-room implementation.
 */

const CR_AUTH_TOKEN_KEY = "cr_auth_token";

// In-memory fallback for SSR / test environments where localStorage is absent.
let _memToken: string | null = null;

function canUseLocalStorage(): boolean {
  try {
    return typeof window !== "undefined" && typeof localStorage !== "undefined";
  } catch {
    return false;
  }
}

/** Read the stored bearer token (regular login or guest JWT). */
export function getStoredToken(): string | null {
  if (canUseLocalStorage()) {
    return localStorage.getItem(CR_AUTH_TOKEN_KEY);
  }
  return _memToken;
}

/** Persist a bearer token (regular login or guest JWT). */
export function setStoredToken(token: string): void {
  if (canUseLocalStorage()) {
    localStorage.setItem(CR_AUTH_TOKEN_KEY, token);
  } else {
    _memToken = token;
  }
}

/** Clear the stored token (on logout or session expiry). */
export function clearStoredToken(): void {
  if (canUseLocalStorage()) {
    localStorage.removeItem(CR_AUTH_TOKEN_KEY);
  }
  _memToken = null;
}

// Track in-flight guest provisioning to avoid duplicate concurrent calls.
let _guestProvisioningPromise: Promise<string> | null = null;

/**
 * Provision a guest JWT from the local backend (POST /auth/guest).
 *
 * Returns the JWT string.  Throws on network or HTTP failure.
 */
function currentPageLocale(explicitLocale?: string): string | undefined {
  if (explicitLocale) return explicitLocale;
  if (typeof document !== "undefined" && document.documentElement.lang) {
    return document.documentElement.lang;
  }
  if (typeof window !== "undefined") {
    const firstSegment = window.location.pathname.split("/")[1];
    return firstSegment || undefined;
  }
  return undefined;
}

async function provisionGuestToken(
  backendUrl: string,
  locale?: string,
): Promise<string> {
  const resolvedLocale = currentPageLocale(locale);
  const resp = await fetch(`${backendUrl}/auth/guest`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(resolvedLocale ? { "Accept-Language": resolvedLocale } : {}),
    },
  });

  if (!resp.ok) {
    throw new Error(`Guest auth failed: ${resp.status} ${resp.statusText}`);
  }

  const data = (await resp.json()) as {
    access_token: string;
    token_type: string;
  };
  return data.access_token;
}

/**
 * Ensure a bearer token is available.
 *
 * When backendEnabled=true and no token is stored, call POST /auth/guest on
 * the local backend, store the resulting JWT, and return it.  Subsequent
 * calls within the same session return the stored token without a network
 * round-trip.
 *
 * When backendEnabled=false, returns null -- the caller uses A2A without
 * identity (demo / org-key-only mode).
 *
 * De-duplicates concurrent first-open calls so only one POST /auth/guest
 * is issued even if the FAB is opened multiple times before the first
 * response arrives.
 */
export async function ensureToken(
  backendEnabled: boolean,
  backendUrl: string,
  locale?: string,
): Promise<string | null> {
  // Return stored token if we already have one.
  const existing = getStoredToken();
  if (existing) return existing;

  // Guest auth only when the local backend is enabled.
  if (!backendEnabled) return null;

  // De-duplicate concurrent calls.
  if (!_guestProvisioningPromise) {
    _guestProvisioningPromise = provisionGuestToken(backendUrl, locale)
      .then((token) => {
        setStoredToken(token);
        _guestProvisioningPromise = null;
        return token;
      })
      .catch((err) => {
        _guestProvisioningPromise = null;
        throw err;
      });
  }

  return _guestProvisioningPromise;
}
