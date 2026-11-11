import {
  createPublicLeadSubmissionController,
  LeadCaptureError,
  extractLeadAttribution,
  submitPublicLead,
  submitPublicLeadWithAttribution,
} from "./lead-capture.js";
import type { ContextRocketBrowserSDK } from "./lead-capture.js";

/** Narrow browser entry for static sites that consume a built SDK artifact. */
const browserSdk: ContextRocketBrowserSDK = Object.freeze({
  createPublicLeadSubmissionController,
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
