import {
  CONSENT_CHANGE_EVENT,
  readConsentPreferences,
} from "./site-consent.js";
import type { ConsentCategory, ConsentPreferences } from "./site-consent.js";

export type { ConsentCategory, ConsentPreferences } from "./site-consent.js";

interface IntegrationBase {
  provider: "google-tag-manager" | "google-analytics" | "posthog" | "script";
  enabled?: boolean;
  consentCategory?: ConsentCategory;
}

export interface SiteIntegrationConfig extends IntegrationBase {
  containerId?: string;
  measurementId?: string;
  projectKey?: string;
  apiHost?: string;
  dataLayerName?: string;
  options?: Record<string, string | number | boolean>;
  src?: string;
  attributes?: Record<string, string>;
  async?: boolean;
  defer?: boolean;
}

export interface SiteIntegrationsConfig {
  integrations: Record<string, SiteIntegrationConfig>;
  consentManaged: boolean;
  consentStorage?: boolean;
  consentBanner?: boolean;
}

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    posthog?: PostHogStub;
  }
}

interface PostHogStub extends Array<unknown> {
  __SV?: number;
  _i?: unknown[][];
  init?: (
    projectKey: string,
    options: Record<string, unknown>,
  ) => void;
  opt_in_capturing?: () => void;
  opt_out_capturing?: () => void;
  [key: string]: unknown;
}

function consentGranted(
  category: ConsentCategory | undefined,
  preferences: ConsentPreferences | null,
  consentManaged: boolean,
): boolean {
  if (!consentManaged || category === "necessary") return true;
  return preferences?.[category ?? "analytics"] === true;
}

function categoryFor(integration: SiteIntegrationConfig): ConsentCategory {
  if (integration.consentCategory) return integration.consentCategory;
  return integration.provider === "google-tag-manager"
    ? "marketing"
    : "analytics";
}

function googleConsentValues(preferences: ConsentPreferences | null) {
  return {
    analytics_storage: preferences?.analytics ? "granted" : "denied",
    ad_storage: preferences?.marketing ? "granted" : "denied",
    ad_user_data: preferences?.marketing ? "granted" : "denied",
    ad_personalization: preferences?.marketing ? "granted" : "denied",
  };
}

function secureOrigin(value: string, fallback: string): string {
  try {
    const url = new URL(value);
    if (url.protocol === "https:") return url.origin;
  } catch {
    // Use the provider default for malformed or insecure origins.
  }
  return fallback;
}

function ensureDataLayer(name: string): unknown[] {
  const target = window as unknown as Window & Record<string, unknown>;
  const current = target[name];
  const layer = Array.isArray(current) ? current : [];
  target[name] = layer;
  return layer;
}

function insertScript(src: string, config: SiteIntegrationConfig): void {
  const script = document.createElement("script");
  script.src = src;
  script.async = config.async !== false;
  if (config.defer === true) script.defer = true;

  if (config.provider === "script") {
    for (const [name, value] of Object.entries(config.attributes ?? {})) {
      if (
        !/^[a-zA-Z_:][a-zA-Z0-9:._-]*$/.test(name) ||
        /^on/i.test(name) ||
        ["src", "type", "async", "defer"].includes(name.toLowerCase())
      ) {
        continue;
      }
      script.setAttribute(name, value);
    }
  }

  document.head.append(script);
}

function loadGoogleTagManager(
  config: SiteIntegrationConfig,
  preferences: ConsentPreferences | null,
): void {
  const containerId = config.containerId?.trim();
  if (!containerId || !/^GTM-[A-Z0-9]+$/i.test(containerId)) return;

  const dataLayerName = config.dataLayerName?.trim() || "dataLayer";
  const dataLayer = ensureDataLayer(dataLayerName);
  dataLayer.push(["consent", "default", googleConsentValues(preferences)]);
  dataLayer.push({ "gtm.start": Date.now(), event: "gtm.js" });

  const layerQuery = dataLayerName === "dataLayer"
    ? ""
    : `&l=${encodeURIComponent(dataLayerName)}`;
  insertScript(
    `https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(containerId)}${layerQuery}`,
    config,
  );
}

function loadGoogleAnalytics(
  config: SiteIntegrationConfig,
  preferences: ConsentPreferences | null,
): void {
  const measurementId = config.measurementId?.trim();
  if (!measurementId || !/^G-[A-Z0-9]+$/i.test(measurementId)) return;

  const dataLayerName = config.dataLayerName?.trim() || "dataLayer";
  const dataLayer = ensureDataLayer(dataLayerName);
  const tag = (...args: unknown[]) => dataLayer.push(args);
  window.gtag = tag;
  tag("consent", "default", googleConsentValues(preferences));
  tag("js", new Date());
  tag("config", measurementId, config.options ?? {});

  const layerQuery = dataLayerName === "dataLayer"
    ? ""
    : `&l=${encodeURIComponent(dataLayerName)}`;
  insertScript(
    `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}${layerQuery}`,
    config,
  );
}

function loadPostHog(config: SiteIntegrationConfig): void {
  const projectKey = config.projectKey?.trim();
  if (!projectKey) return;

  const posthog = window.posthog ?? ([] as unknown as PostHogStub);
  if (!posthog.__SV) {
    const methods =
      "capture identify alias reset register register_once unregister get_distinct_id get_session_id get_session_replay_url opt_in_capturing opt_out_capturing has_opted_in_capturing has_opted_out_capturing clear_opt_in_out_capturing".split(" ");
    posthog._i = [];
    posthog.init = (token, options) => {
      const instance = posthog;
      for (const method of methods) {
        instance[method] = (...args: unknown[]) =>
          instance.push([method, ...args]);
      }
      const apiHost = String(options.api_host);
      const assetsHost = apiHost.replace(
        ".i.posthog.com",
        "-assets.i.posthog.com",
      );
      const script = document.createElement("script");
      script.type = "text/javascript";
      script.crossOrigin = "anonymous";
      script.async = true;
      script.src = `${assetsHost.replace(/\/$/, "")}/static/array.js`;
      document.head.append(script);
      posthog._i?.push([token, options, "posthog"]);
    };
    posthog.__SV = 1;
    window.posthog = posthog;
  }

  const apiHost = secureOrigin(
    config.apiHost?.trim() || "https://us.i.posthog.com",
    "https://us.i.posthog.com",
  );
  const options: Record<string, unknown> = {
    ...(config.options ?? {}),
    api_host: apiHost,
  };
  posthog.init?.(projectKey, options);
}

function loadIntegration(
  config: SiteIntegrationConfig,
  preferences: ConsentPreferences | null,
): void {
  switch (config.provider) {
    case "google-tag-manager":
      loadGoogleTagManager(config, preferences);
      break;
    case "google-analytics":
      loadGoogleAnalytics(config, preferences);
      break;
    case "posthog":
      loadPostHog(config);
      break;
    case "script": {
      if (!config.src) return;
      try {
        const url = new URL(config.src);
        if (url.protocol !== "https:") return;
        insertScript(url.toString(), config);
      } catch {
        // Invalid extension URLs are ignored.
      }
      break;
    }
  }
}

function updateLoadedIntegrations(
  preferences: ConsentPreferences,
  integrations: Record<string, SiteIntegrationConfig>,
  loaded: Set<string>,
  consentManaged: boolean,
): void {
  window.gtag?.("consent", "update", googleConsentValues(preferences));
  for (const [key, integration] of Object.entries(integrations)) {
    if (!loaded.has(key) || integration.provider !== "google-tag-manager") {
      continue;
    }
    const dataLayerName = integration.dataLayerName?.trim() || "dataLayer";
    ensureDataLayer(dataLayerName).push([
      "consent",
      "update",
      googleConsentValues(preferences),
    ]);
  }
  const posthogIntegration = Object.entries(integrations).find(
    ([key, integration]) =>
      loaded.has(key) && integration.provider === "posthog",
  )?.[1];
  if (posthogIntegration) {
    if (
      consentGranted(
        categoryFor(posthogIntegration),
        preferences,
        consentManaged,
      )
    ) {
      window.posthog?.opt_in_capturing?.();
    } else {
      window.posthog?.opt_out_capturing?.();
    }
  }
}

export function initializeSiteIntegrations(
  config: SiteIntegrationsConfig,
): void {
  let preferences = config.consentManaged && config.consentStorage !== false
    ? readConsentPreferences()
    : null;
  const loaded = new Set<string>();
  const unrestrictedPreferences: ConsentPreferences = {
    necessary: true,
    functional: true,
    analytics: true,
    marketing: true,
  };

  const apply = () => {
    for (const [key, integration] of Object.entries(config.integrations)) {
      if (integration.enabled === false || loaded.has(key)) continue;
      const category = categoryFor(integration);
      if (!consentGranted(category, preferences, config.consentManaged)) {
        continue;
      }
      loaded.add(key);
      loadIntegration(
        integration,
        config.consentManaged ? preferences : unrestrictedPreferences,
      );
      if (integration.provider === "posthog") {
        if (
          consentGranted(
            category,
            preferences,
            config.consentManaged,
          )
        ) {
          window.posthog?.opt_in_capturing?.();
        } else {
          window.posthog?.opt_out_capturing?.();
        }
      }
    }
  };

  apply();
  window.addEventListener(CONSENT_CHANGE_EVENT, (event) => {
    const detail = (event as CustomEvent<{ preferences?: ConsentPreferences }>).detail;
    if (!detail?.preferences) return;
    preferences = {
      necessary: true,
      functional: detail.preferences.functional === true,
      analytics: detail.preferences.analytics === true,
      marketing: detail.preferences.marketing === true,
    };
    updateLoadedIntegrations(
      preferences,
      config.integrations,
      loaded,
      config.consentManaged,
    );
    apply();
  });
}
