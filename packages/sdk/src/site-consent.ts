/** Shared browser consent state and the DOM behavior for the starter banner. */

export type ConsentCategory =
  | "necessary"
  | "functional"
  | "analytics"
  | "marketing";

export interface ConsentPreferences {
  necessary: true;
  functional: boolean;
  analytics: boolean;
  marketing: boolean;
}

export type ConsentChoice = "accept" | "deny" | "custom";

export const CONSENT_CHANGE_EVENT = "cr:consent-change";
export const OPEN_SETTINGS_EVENT = "cr:open-cookie-settings";
export const CONSENT_STORAGE_KEY = "cr_cookie_consent";

export function emptyConsentPreferences(): ConsentPreferences {
  return {
    necessary: true,
    functional: false,
    analytics: false,
    marketing: false,
  };
}

/** Read versioned consent, migrating the original all-or-nothing choice. */
export function readConsentPreferences(): ConsentPreferences | null {
  try {
    const stored = JSON.parse(localStorage.getItem(CONSENT_STORAGE_KEY) || "null");
    if (stored?.version === 2 && stored.preferences) {
      return {
        necessary: true,
        functional: stored.preferences.functional === true,
        analytics: stored.preferences.analytics === true,
        marketing: stored.preferences.marketing === true,
      };
    }
    if (stored?.version === 1 && stored.choice) {
      const accepted = stored.choice === "accept";
      return {
        necessary: true,
        functional: accepted,
        analytics: accepted,
        marketing: accepted,
      };
    }
  } catch {
    // Keep the banner visible when browser storage is unavailable.
  }
  return null;
}

/** Persist a choice when possible and apply it for this page view regardless. */
export function saveConsentPreferences(
  preferences: ConsentPreferences,
  choice: ConsentChoice,
): void {
  try {
    localStorage.setItem(
      CONSENT_STORAGE_KEY,
      JSON.stringify({
        version: 2,
        choice,
        preferences,
        at: new Date().toISOString(),
      }),
    );
  } catch {
    // Consent still applies for this page view if storage is blocked.
  }
  window.dispatchEvent(
    new CustomEvent(CONSENT_CHANGE_EVENT, {
      detail: { version: 2, preferences },
    }),
  );
}

/** Bind the starter's localized cookie-banner markup to shared consent state. */
export function initializeCookieBanner(): void {
  const banner = document.getElementById("cr-cookie-banner");
  if (!banner || banner.dataset.consentInitialized === "true") return;
  const bannerElement = banner;
  bannerElement.dataset.consentInitialized = "true";

  const settings = document.getElementById("cr-cookie-settings");
  const manageButton = bannerElement.querySelector<HTMLButtonElement>('[data-action="manage"]');
  const saveButton = bannerElement.querySelector<HTMLButtonElement>('[data-action="save"]');
  const denyButton = bannerElement.querySelector<HTMLButtonElement>('[data-consent="deny"]');
  const acceptButton = bannerElement.querySelector<HTMLButtonElement>('[data-consent="accept"]');

  function updateCheckboxes(preferences: ConsentPreferences): void {
    ( ["functional", "analytics", "marketing"] as const).forEach((category) => {
      const checkbox = bannerElement.querySelector<HTMLInputElement>(`[name="${category}"]`);
      if (checkbox) checkbox.checked = preferences[category];
    });
  }

  function setSettingsOpen(open: boolean): void {
    if (!settings) return;
    settings.hidden = !open;
    manageButton?.setAttribute("aria-expanded", String(open));
    denyButton?.classList.toggle("hidden", open);
    acceptButton?.classList.toggle("hidden", open);
    saveButton?.classList.toggle("hidden", !open);
    if (open) settings.querySelector<HTMLInputElement>("input:not(:disabled)")?.focus();
  }

  function finish(preferences: ConsentPreferences, choice: ConsentChoice): void {
    saveConsentPreferences(preferences, choice);
    bannerElement.classList.add("hidden");
    setSettingsOpen(false);
  }

  function openSettings(edit = true): void {
    updateCheckboxes(readConsentPreferences() || emptyConsentPreferences());
    bannerElement.classList.remove("hidden");
    setSettingsOpen(edit);
  }

  const saved = readConsentPreferences();
  if (saved) updateCheckboxes(saved);
  else bannerElement.classList.remove("hidden");

  manageButton?.addEventListener("click", () => {
    openSettings(manageButton.getAttribute("aria-expanded") !== "true");
  });
  denyButton?.addEventListener("click", () => {
    finish(emptyConsentPreferences(), "deny");
  });
  acceptButton?.addEventListener("click", () => {
    finish({
      necessary: true,
      functional: true,
      analytics: true,
      marketing: true,
    }, "accept");
  });
  saveButton?.addEventListener("click", () => {
    const preferences = emptyConsentPreferences();
    ( ["functional", "analytics", "marketing"] as const).forEach((category) => {
      const checkbox = bannerElement.querySelector<HTMLInputElement>(`[name="${category}"]`);
      preferences[category] = checkbox?.checked === true;
    });
    finish(preferences, "custom");
  });

  document.addEventListener("click", (event) => {
    const target = event.target;
    if (target instanceof Element && target.closest("[data-open-cookie-settings]")) {
      event.preventDefault();
      openSettings(true);
    }
  });
  window.addEventListener(OPEN_SETTINGS_EVENT, () => openSettings(true));
}
