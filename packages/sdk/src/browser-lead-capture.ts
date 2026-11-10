import {
  LeadCaptureError,
  extractLeadAttribution,
  submitPublicLead,
  submitPublicLeadWithAttribution,
} from "./lead-capture.js";

/** Narrow browser entry for static sites that consume a built SDK artifact. */
const browserSdk = Object.freeze({
  LeadCaptureError,
  extractLeadAttribution,
  submitPublicLead,
  submitPublicLeadWithAttribution,
});

Object.defineProperty(globalThis, "ContextRocketSDK", {
  configurable: false,
  enumerable: false,
  value: browserSdk,
  writable: false,
});

declare global {
  // The full typed SDK remains available through the npm package. This global
  // is only for the generated, dependency-free starter artifact.
  var ContextRocketSDK: typeof browserSdk;
}
