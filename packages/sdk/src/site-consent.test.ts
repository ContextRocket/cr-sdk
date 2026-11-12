import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CONSENT_CHANGE_EVENT,
  CONSENT_STORAGE_KEY,
  emptyConsentPreferences,
  readConsentPreferences,
  saveConsentPreferences,
} from "./site-consent.js";

describe("site consent contract", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("returns no choice when storage has no saved value", () => {
    vi.stubGlobal("localStorage", { getItem: () => null });
    expect(readConsentPreferences()).toBeNull();
  });

  it("migrates the original all-or-nothing choice", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => JSON.stringify({ version: 1, choice: "accept" }),
    });
    expect(readConsentPreferences()).toEqual({
      necessary: true,
      functional: true,
      analytics: true,
      marketing: true,
    });
  });

  it("reads versioned category preferences and treats unknown values as denied", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => JSON.stringify({
        version: 2,
        preferences: { functional: true, analytics: "yes", marketing: false },
      }),
    });
    expect(readConsentPreferences()).toEqual({
      necessary: true,
      functional: true,
      analytics: false,
      marketing: false,
    });
  });

  it("applies consent and emits the shared event when storage is unavailable", () => {
    const eventTarget = { dispatchEvent: vi.fn() };
    vi.stubGlobal("localStorage", {
      setItem: () => { throw new Error("storage disabled"); },
    });
    vi.stubGlobal("window", eventTarget);

    const preferences = emptyConsentPreferences();
    expect(() => saveConsentPreferences(preferences, "deny")).not.toThrow();
    expect(eventTarget.dispatchEvent).toHaveBeenCalledOnce();
    expect(eventTarget.dispatchEvent.mock.calls[0]?.[0]).toMatchObject({
      type: CONSENT_CHANGE_EVENT,
      detail: { version: 2, preferences },
    });
  });

  it("stores the versioned choice when storage is available", () => {
    const setItem = vi.fn();
    vi.stubGlobal("localStorage", { setItem });
    vi.stubGlobal("window", { dispatchEvent: vi.fn() });

    saveConsentPreferences(emptyConsentPreferences(), "custom");

    expect(setItem).toHaveBeenCalledOnce();
    expect(setItem.mock.calls[0]?.[0]).toBe(CONSENT_STORAGE_KEY);
    expect(JSON.parse(setItem.mock.calls[0]?.[1] as string)).toMatchObject({
      version: 2,
      choice: "custom",
      preferences: emptyConsentPreferences(),
    });
  });
});
