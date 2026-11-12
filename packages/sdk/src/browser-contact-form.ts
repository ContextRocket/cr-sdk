import {
  createContactFormController,
  ContactFormError,
  mapContactFormData,
  mapCustomContactAnswers,
  extractContactAttribution,
  submitContactForm,
  submitContactFormWithAttribution,
} from "./contact-form.js";
import type { ContextRocketBrowserSDK } from "./contact-form.js";

/** Narrow browser entry for static sites that consume a built SDK artifact. */
const browserSdk: ContextRocketBrowserSDK = Object.freeze({
  createContactFormController,
  mapContactFormData,
  mapCustomContactAnswers,
  ContactFormError,
  extractContactAttribution,
  submitContactForm,
  submitContactFormWithAttribution,
});

Object.defineProperty(globalThis, "ContextRocketSDK", {
  configurable: false,
  enumerable: false,
  value: browserSdk,
  writable: false,
});
