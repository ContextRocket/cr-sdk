/**
 * Port interface for credential management.
 *
 * Abstracts storage (localStorage / in-memory) and guest-token provisioning
 * (fetch to POST /auth/guest) behind a testable seam.
 *
 * Origin: clean-room port extraction from credentials.ts.
 */

export interface CredentialsPort {
  ensureToken(locale?: string): Promise<string | null>;
  getStoredToken(): string | null;
  setStoredToken(token: string): void;
  clearStoredToken(): void;
}

// ── Production adapter ─────────────────────────────────────────────────────────

const CR_AUTH_TOKEN_KEY = "cr_auth_token";

function canUseLocalStorage(): boolean {
  try {
    return typeof window !== "undefined" && typeof localStorage !== "undefined";
  } catch {
    return false;
  }
}

export function createCredentialsPort(
  fetchImpl: typeof fetch,
  backendUrl: string,
  backendEnabled: boolean,
): CredentialsPort {
  let _memToken: string | null = null;
  let _guestProvisioningPromise: Promise<string> | null = null;

  function readToken(): string | null {
    if (canUseLocalStorage()) {
      return localStorage.getItem(CR_AUTH_TOKEN_KEY);
    }
    return _memToken;
  }

  function writeToken(token: string): void {
    if (canUseLocalStorage()) {
      localStorage.setItem(CR_AUTH_TOKEN_KEY, token);
    } else {
      _memToken = token;
    }
  }

  function deleteToken(): void {
    if (canUseLocalStorage()) {
      localStorage.removeItem(CR_AUTH_TOKEN_KEY);
    }
    _memToken = null;
  }

  async function provisionGuestToken(locale?: string): Promise<string> {
    const resp = await fetchImpl(`${backendUrl}/auth/guest`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(locale ? { "Accept-Language": locale } : {}),
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

  return {
    getStoredToken: readToken,
    setStoredToken: writeToken,
    clearStoredToken: deleteToken,

    async ensureToken(locale?: string): Promise<string | null> {
      const existing = readToken();
      if (existing) return existing;

      if (!backendEnabled) return null;

      if (!_guestProvisioningPromise) {
        _guestProvisioningPromise = provisionGuestToken(locale)
          .then((token) => {
            writeToken(token);
            _guestProvisioningPromise = null;
            return token;
          })
          .catch((err) => {
            _guestProvisioningPromise = null;
            throw err;
          });
      }

      return _guestProvisioningPromise;
    },
  };
}

// ── In-memory test double ──────────────────────────────────────────────────────

export function createInMemoryCredentialsPort(handler: {
  provisionToken?: () => Promise<string>;
  storedToken?: string | null;
}): CredentialsPort {
  let _token: string | null = handler.storedToken ?? null;

  return {
    getStoredToken: () => _token,
    setStoredToken(token: string) {
      _token = token;
    },
    clearStoredToken() {
      _token = null;
    },
    async ensureToken(): Promise<string | null> {
      if (_token) return _token;
      if (!handler.provisionToken) return null;

      const token = await handler.provisionToken();
      _token = token;
      return token;
    },
  };
}
