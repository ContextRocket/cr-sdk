import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CONSENT_CHANGE_EVENT,
  type ConsentPreferences,
} from "./site-consent.js";
import {
  initializeSiteIntegrations,
  type SiteIntegrationsConfig,
} from "./site-integrations.js";

function installBrowserStubs() {
  const scripts: Array<{
    src: string;
    async: boolean;
    defer: boolean;
    attributes: Record<string, string>;
    setAttribute(name: string, value: string): void;
  }> = [];
  const listeners = new Map<string, EventListener>();
  const head = {
    append(script: (typeof scripts)[number]) {
      scripts.push(script);
    },
  };
  const document = {
    head,
    createElement: vi.fn(() => ({
      src: "",
      async: false,
      defer: false,
      attributes: {},
      setAttribute(name: string, value: string) {
        this.attributes[name] = value;
      },
    })),
  };
  const window = {
    addEventListener: vi.fn((name: string, listener: EventListener) => {
      listeners.set(name, listener);
    }),
    dataLayer: undefined as unknown[] | undefined,
  };
  vi.stubGlobal("document", document);
  vi.stubGlobal("window", window);
  vi.stubGlobal("localStorage", { getItem: () => null });

  return {
    scripts,
    window,
    grant(preferences: ConsentPreferences) {
      const listener = listeners.get(CONSENT_CHANGE_EVENT);
      if (!listener) throw new Error("Consent listener was not registered");
      listener({ detail: { preferences } } as CustomEvent<{
        preferences: ConsentPreferences;
      }>);
    },
  };
}

const allConsents: ConsentPreferences = {
  necessary: true,
  functional: true,
  analytics: true,
  marketing: true,
};

afterEach(() => vi.unstubAllGlobals());

describe("site integrations", () => {
  it("waits for the configured consent category before loading an integration", () => {
    const browser = installBrowserStubs();
    const config: SiteIntegrationsConfig = {
      consentManaged: true,
      integrations: {
        analytics: {
          provider: "google-analytics",
          measurementId: "G-ABC123",
        },
      },
    };

    initializeSiteIntegrations(config);
    expect(browser.scripts).toHaveLength(0);

    browser.grant(allConsents);

    expect(browser.scripts).toHaveLength(1);
    expect(browser.scripts[0]?.src).toBe(
      "https://www.googletagmanager.com/gtag/js?id=G-ABC123",
    );
    expect(browser.window.dataLayer).toEqual([
      ["consent", "default", {
        analytics_storage: "granted",
        ad_storage: "granted",
        ad_user_data: "granted",
        ad_personalization: "granted",
      }],
      ["js", expect.any(Date)],
      ["config", "G-ABC123", {}],
    ]);
  });

  it("validates built-in provider IDs and only loads explicit HTTPS extensions", () => {
    const browser = installBrowserStubs();
    initializeSiteIntegrations({
      consentManaged: false,
      integrations: {
        invalidTag: {
          provider: "google-tag-manager",
          containerId: "G-ABC123",
        },
        insecureExtension: {
          provider: "script",
          src: "http://metrics.example.test/script.js",
        },
        extension: {
          provider: "script",
          src: "https://metrics.example.test/script.js",
          attributes: {
            integrity: "sha256-example",
            onload: "alert(1)",
            src: "https://attacker.example.test/override.js",
          },
        },
      },
    });

    expect(browser.scripts).toHaveLength(1);
    expect(browser.scripts[0]?.src).toBe(
      "https://metrics.example.test/script.js",
    );
    expect(browser.scripts[0]?.attributes).toEqual({
      integrity: "sha256-example",
    });
  });
});
