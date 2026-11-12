import { initializeCookieBanner } from "./site-consent.js";
import {
  initializeSiteIntegrations,
  type SiteIntegrationsConfig,
} from "./site-integrations.js";

export interface ContextRocketSiteBehaviors {
  initialize(config: SiteIntegrationsConfig): void;
}

declare global {
  interface Window {
    ContextRocketSiteBehaviors?: ContextRocketSiteBehaviors;
  }
}

const siteBehaviors: ContextRocketSiteBehaviors = Object.freeze({
  initialize(config: SiteIntegrationsConfig) {
    if (config.consentBanner) initializeCookieBanner();
    if (Object.keys(config.integrations).length > 0) {
      initializeSiteIntegrations(config);
    }
  },
});

Object.defineProperty(globalThis, "ContextRocketSiteBehaviors", {
  configurable: false,
  enumerable: false,
  value: siteBehaviors,
  writable: false,
});

const configNode = document.getElementById("cr-site-integrations-config");
if (configNode?.textContent) {
  try {
    siteBehaviors.initialize(JSON.parse(configNode.textContent) as SiteIntegrationsConfig);
  } catch {
    console.error("ContextRocket site behavior configuration is invalid.");
  }
}
