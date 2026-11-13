import { streamEmbedA2aSubscribe } from "./a2a-transport";
import {
  applyTransportEvent,
  beginSend,
  canSend,
  createInitialChatState,
  type WidgetChatState,
} from "./chat-state";
import {
  buildPoweredByHref,
  buildWidgetAgentCardUrl,
  parseWidgetConfig,
} from "./config";
import { renderMarkdown } from "./markdown";
import { safeHref, escapeHtml } from "./safe-url";
import { widgetStyles } from "./styles";
import type { WidgetConfig, WidgetDemoCard } from "./types";
import { copyFor, type WidgetCopy } from "./copy";
import {
  hasViewportAnchoredAncestor,
  launcherBottomLift,
  type PlacementRect,
} from "./launcher-placement";
import rocketSpark from "./rocket-spark.svg";
import logoInk from "./logo-h-spark-ink.svg";
import logoWhite from "./logo-h-spark-white.svg";

const rocketImage = (color = "#FFFFFF") =>
  `data:image/svg+xml,${encodeURIComponent(rocketSpark.replaceAll("currentColor", color))}`;
const logoDataUri = (svg: string) => `data:image/svg+xml,${encodeURIComponent(svg)}`;
const poweredByLogos = { ink: logoDataUri(logoInk), white: logoDataUri(logoWhite) };
const CHAT_SCROLL_BOTTOM_THRESHOLD = 48;
const demoCards = new Set<WidgetDemoCard>([
  "Evidence",
  "Progress",
  "Question",
  "ProposalBatch",
  "Representation",
]);

function isWidgetDemoCard(value: string | undefined): value is WidgetDemoCard {
  return value !== undefined && demoCards.has(value as WidgetDemoCard);
}

const ELEMENT_TAG = "contextrocket-chat";
const CONSENT_STORAGE_KEY = "cr_cookie_consent";
const CONSENT_CHANGE_EVENT = "cr:consent-change";

export class ContextRocketChatElement extends HTMLElement {
  #config: WidgetConfig | null = null;
  #state: WidgetChatState = createInitialChatState();
  #shadow: ShadowRoot;
  #runId = 0;
  #assistantMessageId: string | null = null;
  #lastUserMessage = "";
  #lastUserMessageId: string | undefined;
  #lastDemoCard: WidgetDemoCard | undefined;
  #abortController: AbortController | null = null;
  #suggestions: string[] = [];
  #suggestionTab: "questions" | "cards" = "questions";
  #suggestionDiscoveryKey: string | null = null;
  #suggestionDiscoveryRun = 0;
  #fullscreen = false;
  #forceMessagesToBottom = false;
  #launcherPlacementFrame = 0;
  #consentResolved = false;

  #launcher!: HTMLButtonElement;
  #fullscreenButton!: HTMLButtonElement;
  #panel!: HTMLDivElement;
  #messages!: HTMLDivElement;
  #input!: HTMLInputElement;
  #send!: HTMLButtonElement;
  #error!: HTMLParagraphElement;
  #status!: HTMLParagraphElement;
  #retry!: HTMLButtonElement;
  #footerLink!: HTMLAnchorElement;
  #footerLogo!: HTMLImageElement;

  static get observedAttributes(): string[] {
    return [
      "data-contextrocket-api-key",
      "data-contextrocket-handle",
      "data-contextrocket-subject-kind",
      "data-contextrocket-mode",
      "data-contextrocket-api-base",
      "data-contextrocket-accent",
      "data-contextrocket-launcher-color",
      "data-contextrocket-greeting",
      "data-contextrocket-title",
      "data-contextrocket-header-logo",
      "data-contextrocket-header-background",
      "data-contextrocket-header-foreground",
      "data-contextrocket-subtitle",
      "data-contextrocket-title-badge",
      "data-contextrocket-launcher-appearance",
      "data-contextrocket-launcher-avatar-background",
      "data-contextrocket-agent-avatar-style",
      "data-contextrocket-agent-header-start",
      "data-contextrocket-agent-header-end",
      "data-contextrocket-agent-avatar",
      "data-contextrocket-launcher-avatar",
      "data-contextrocket-ref",
      "data-contextrocket-background",
      "data-contextrocket-foreground",
      "data-contextrocket-surface",
      "data-contextrocket-muted",
      "data-contextrocket-border",
      "data-contextrocket-powered-by-logo",
      "data-contextrocket-suggestions",
      "data-contextrocket-position",
      "data-contextrocket-fullscreen",
      "data-contextrocket-fullscreen-on-open",
      "data-contextrocket-fullscreen-on-load",
      "data-contextrocket-locale",
    ];
  }

  constructor() {
    super();
    this.#shadow = this.attachShadow({ mode: "open" });
  }

  connectedCallback(): void {
    this.#config = parseWidgetConfig(this);
    if (!this.#config) return;

    this.lang = this.#config.locale!;
    this.#state = createInitialChatState(this.#config.greeting);
    this.#render();
    this.#syncConsentGate();
    this.#bindEvents();
    this.#syncUi();
    this.#scheduleLauncherPlacement();
    window.addEventListener("scroll", this.#scheduleLauncherPlacement, true);
    window.addEventListener(CONSENT_CHANGE_EVENT, this.#handleConsentChange);
    window.addEventListener("resize", this.#scheduleLauncherPlacement);
    window.visualViewport?.addEventListener("scroll", this.#scheduleLauncherPlacement);
    window.visualViewport?.addEventListener("resize", this.#scheduleLauncherPlacement);
    document.addEventListener("input", this.#scheduleLauncherPlacement, true);
    document.addEventListener("change", this.#scheduleLauncherPlacement, true);
    document.addEventListener("toggle", this.#scheduleLauncherPlacement, true);
    this.#setFullscreen(this.#config.fullscreenOnLoad === true);
    this.#setOpen(this.#config.fullscreenOnLoad === true);
    void this.#loadSuggestions();
  }

  disconnectedCallback(): void {
    window.removeEventListener(CONSENT_CHANGE_EVENT, this.#handleConsentChange);
    window.removeEventListener("scroll", this.#scheduleLauncherPlacement, true);
    window.removeEventListener("resize", this.#scheduleLauncherPlacement);
    window.visualViewport?.removeEventListener("scroll", this.#scheduleLauncherPlacement);
    window.visualViewport?.removeEventListener("resize", this.#scheduleLauncherPlacement);
    document.removeEventListener("input", this.#scheduleLauncherPlacement, true);
    document.removeEventListener("change", this.#scheduleLauncherPlacement, true);
    document.removeEventListener("toggle", this.#scheduleLauncherPlacement, true);
    if (this.#launcherPlacementFrame)
      window.cancelAnimationFrame(this.#launcherPlacementFrame);
  }

  #hasSavedConsent(): boolean {
    try {
      const saved: unknown = JSON.parse(localStorage.getItem(CONSENT_STORAGE_KEY) || "null");
      if (!saved || typeof saved !== "object") return false;
      const record = saved as { version?: unknown; choice?: unknown; preferences?: unknown };
      return (record.version === 2 && !!record.preferences && typeof record.preferences === "object") ||
        (record.version === 1 && typeof record.choice === "string");
    } catch {
      return false;
    }
  }

  #syncConsentGate(): void {
    if (!this.#config?.consentGate) return;
    this.#consentResolved = this.#hasSavedConsent();
    const root = this.#shadow.querySelector<HTMLElement>(".cr-root");
    if (root) {
      root.hidden = !this.#consentResolved;
      root.style.display = this.#consentResolved ? "" : "none";
    }
  }

  #handleConsentChange = (): void => {
    this.#consentResolved = true;
    const root = this.#shadow.querySelector<HTMLElement>(".cr-root");
    if (root) {
      root.hidden = false;
      root.style.removeProperty("display");
    }
  };

  #scheduleLauncherPlacement = (): void => {
    if (this.#launcherPlacementFrame) return;
    this.#launcherPlacementFrame = window.requestAnimationFrame(() => {
      this.#launcherPlacementFrame = 0;
      this.#updateLauncherPlacement();
    });
  };

  #updateLauncherPlacement(): void {
    const root = this.#shadow.querySelector<HTMLElement>(".cr-root");
    if (!root || !this.#launcher) return;
    if (this.#launcher.hidden) {
      root.style.removeProperty("--cr-fab-lift");
      return;
    }
    if (!window.matchMedia("(max-width: 30rem)").matches) {
      root.style.removeProperty("--cr-fab-lift");
      return;
    }
    // Measure the configured edge position each time so the previous lift
    // does not make the launcher appear clear and cause it to bounce back.
    root.style.removeProperty("--cr-fab-lift");
    const launcherRect = this.#launcher.getBoundingClientRect();
    const controls = Array.from(
      document.querySelectorAll<HTMLElement>(
        'input:not([type="hidden"]), select, textarea, button, a[href], [role="button"], [tabindex="0"]',
      ),
    ).flatMap((control): PlacementRect[] => {
      const style = window.getComputedStyle(control);
      if (style.display === "none" || style.visibility === "hidden") return [];
      // Long in-content navigation lists must not lift the launcher through
      // article headings. Only sticky/fixed chrome can obstruct the viewport.
      let ancestor: HTMLElement | null = control;
      const ancestorPositions: string[] = [];
      while (ancestor && ancestor !== document.body) {
        ancestorPositions.push(window.getComputedStyle(ancestor).position);
        ancestor = ancestor.parentElement;
      }
      if (!hasViewportAnchoredAncestor(ancestorPositions)) return [];
      const controlRect = control.getBoundingClientRect();
      const label = control.closest("label");
      const parent = control.parentElement;
      const parentRect = parent?.getBoundingClientRect();
      const rect = label?.getBoundingClientRect() ?? (
        parent && parent !== document.body && parentRect &&
        parentRect.height <= controlRect.height + 64 &&
        parentRect.width >= controlRect.width
          ? parentRect
          : controlRect
      );
      return rect.width > 0 && rect.height > 0
        ? [{ top: rect.top, right: rect.right, bottom: rect.bottom, left: rect.left }]
        : [];
    });
    const lift = launcherBottomLift(
      {
        top: launcherRect.top,
        right: launcherRect.right,
        bottom: launcherRect.bottom,
        left: launcherRect.left,
      },
      controls,
    );
    if (lift > 0) root.style.setProperty("--cr-fab-lift", `${lift}px`);
    else root.style.removeProperty("--cr-fab-lift");
  }

  attributeChangedCallback(): void {
    if (!this.isConnected) return;
    const next = parseWidgetConfig(this);
    if (!next) return;
    this.#config = next;
    this.lang = next.locale!;
    if (!this.#footerLink) return;
    const copy = copyFor(next);
    const root = this.#shadow.querySelector<HTMLElement>(".cr-root")!;
    root.lang = this.lang;
    this.#shadow.querySelector<HTMLElement>(".cr-title-text")!.textContent =
      next.title ?? copy.defaultTitle;
    const subtitle = this.#shadow.querySelector<HTMLElement>(".cr-title-subtitle")!;
    subtitle.textContent = next.subtitle ?? "";
    subtitle.hidden = !next.subtitle;
    const titleBadge = this.#shadow.querySelector<HTMLElement>(".cr-title-badge")!;
    titleBadge.textContent = next.titleBadge ?? "";
    titleBadge.hidden = !next.titleBadge;
    this.#panel.setAttribute("aria-label", next.title ?? copy.defaultTitle);
    this.#shadow
      .querySelector(".cr-close")!
      .setAttribute("aria-label", copy.close);
    this.#fullscreenButton.hidden = !(
      next.fullscreen || next.fullscreenOnOpen || next.fullscreenOnLoad
    );
    this.#fullscreenButton.setAttribute(
      "aria-label",
      this.#fullscreen ? copy.collapse : copy.expand,
    );
    if (!next.fullscreen && !next.fullscreenOnOpen && !next.fullscreenOnLoad) {
      this.#setFullscreen(false);
    }
    this.#launcher.setAttribute(
      "aria-label",
      this.#panel.dataset.open === "true" ? copy.close : copy.open,
    );
    this.#input.placeholder = copy.placeholder;
    this.#input.setAttribute("aria-label", copy.placeholder);
    this.#retry.textContent = copy.retry;
    this.#footerLink.setAttribute("aria-label", copy.poweredBy);
    this.#footerLink.querySelector(".powered-by-label")!.textContent = copy.poweredByLabel;
    this.#footerLogo.src = poweredByLogos[next.poweredByLogo ?? "ink"];
    this.#shadow.querySelector<HTMLImageElement>(".cr-launcher-icon-open")!.src =
      rocketImage(next.launcherForeground);
    const launcherRocket = this.#shadow.querySelector<HTMLImageElement>(".cr-launcher-icon-open")!;
    const launcherAvatar = this.#shadow.querySelector<HTMLImageElement>(".cr-launcher-avatar");
    launcherRocket.hidden = Boolean(next.launcherAvatarUrl);
    if (launcherAvatar) {
      launcherAvatar.hidden = !next.launcherAvatarUrl;
      if (next.launcherAvatarUrl) launcherAvatar.src = next.launcherAvatarUrl;
    }
    root.dataset.launcherAppearance = next.launcherAppearance ?? "brand";
    root.dataset.agentAvatarStyle = next.agentAvatarStyle ?? "circle";
    this.#syncUi();
    this.#footerLink.href = buildPoweredByHref(next);
    this.style.setProperty("--cr-accent", next.accentColor ?? "#0e0f13");
    this.#applyTheme(next);
    this.#shadow
      .querySelector<HTMLElement>(".cr-root")
      ?.setAttribute("data-position", next.position ?? "bottom-right");
    this.#scheduleLauncherPlacement();
    if (next.suggestions) this.#suggestions = next.suggestions;
    void this.#loadSuggestions();
  }

  #render(): void {
    const config = this.#config!;
    const copy = copyFor(config);
    const style = document.createElement("style");
    style.textContent = widgetStyles(config.accentColor);

    const root = document.createElement("div");
    root.className = "cr-root";
    root.lang = this.lang;
    root.dataset.position = config.position ?? "bottom-right";
    root.dataset.headerLogo = String(Boolean(config.headerLogoUrl));
    root.innerHTML = `
      <div class="cr-panel" data-open="false" data-position="${escapeHtml(config.position ?? "bottom-right")}" part="panel" role="dialog" aria-modal="true" aria-hidden="true" aria-label="${escapeHtml(config.title ?? copy.defaultTitle)}" inert>
        <header class="cr-header">
          <h2 class="cr-title"${config.headerLogoUrl ? ` aria-label="${escapeHtml(config.title ?? copy.defaultTitle)}"` : ""}>${config.headerLogoUrl ? `<img class="cr-title-brand-logo" src="${escapeHtml(config.headerLogoUrl)}" alt="" aria-hidden="true">` : `<span class="cr-title-probe"></span><span class="cr-title-copy"><span class="cr-title-heading"><span class="cr-title-text">${escapeHtml(config.title ?? copy.defaultTitle)}</span><span class="cr-title-badge"${config.titleBadge ? "" : " hidden"}>${escapeHtml(config.titleBadge ?? "")}</span></span><span class="cr-title-subtitle"${config.subtitle ? "" : " hidden"}>${escapeHtml(config.subtitle ?? "")}</span></span>`}</h2>
          <div class="cr-header-actions">
            <button type="button" class="cr-fullscreen-toggle" aria-label="${copy.expand}" aria-pressed="false"${config.fullscreen || config.fullscreenOnOpen || config.fullscreenOnLoad ? "" : " hidden"}>
              <svg class="cr-fullscreen-expand-icon" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M16 3h3a2 2 0 0 1 2 2v3"/><path d="M21 16v3a2 2 0 0 1-2 2h-3"/><path d="M8 21H5a2 2 0 0 1-2-2v-3"/></svg>
              <svg class="cr-fullscreen-collapse-icon" hidden xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 8V5"/><path d="M8 8H5"/><path d="M16 8h3"/><path d="M16 8V5"/><path d="M16 16v3"/><path d="M16 16h3"/><path d="M8 16H5"/><path d="M8 16v3"/></svg>
            </button>
            <button type="button" class="cr-close" aria-label="${copy.close}"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg></button>
          </div>
        </header>
        <div class="cr-messages" part="messages" role="log" aria-live="polite"></div>
        <p class="cr-status" role="status" aria-live="polite" hidden></p>
        <p class="cr-error" role="alert" hidden part="error"></p>
        <button type="button" class="cr-retry" hidden>${copy.retry}</button>
        <form class="cr-composer" part="composer">
          <input class="cr-input" type="text" autocomplete="off" placeholder="${copy.placeholder}" aria-label="${copy.placeholder}" />
          <button class="cr-send" type="submit" data-state="send" aria-label="${copy.send}"></button>
        </form>
        <footer class="cr-footer" part="footer">
          <a class="powered-by-badge" href="${escapeHtml(buildPoweredByHref(config))}" target="_blank" rel="noopener noreferrer" aria-label="${escapeHtml(copy.poweredBy)}">
            <span class="powered-by-label">${escapeHtml(copy.poweredByLabel)}</span>
            <img class="powered-by-logo" src="${poweredByLogos[config.poweredByLogo ?? "ink"]}" alt="ContextRocket" width="149" height="20">
          </a>
        </footer>
      </div>
      <button type="button" class="cr-launcher" aria-label="${copy.open}" aria-expanded="false" aria-controls="contextrocket-chat-panel" part="launcher">
        <img class="cr-launcher-icon-open" src="${rocketImage(config.launcherForeground)}" alt="" width="28" height="28" aria-hidden="true"${config.launcherAvatarUrl ? " hidden" : ""}>
        <img class="cr-launcher-avatar"${config.launcherAvatarUrl ? ` src="${escapeHtml(config.launcherAvatarUrl)}"` : ""} alt="" width="44" height="44" aria-hidden="true"${config.launcherAvatarUrl ? "" : " hidden"}>
      </button>
    `;

    this.#shadow.replaceChildren(style, root);
    this.#panel = this.#shadow.querySelector(".cr-panel") as HTMLDivElement;
    this.#panel.id = "contextrocket-chat-panel";
    const titleProbePlaceholder = this.#shadow.querySelector(".cr-title-probe");
    if (titleProbePlaceholder) {
      const titleProbe = this.#createProbe(false);
      titleProbe.classList.add("cr-title-probe");
      titleProbePlaceholder.replaceWith(titleProbe);
    }
    this.#shadow.querySelector<HTMLImageElement>(".cr-title-brand-logo")?.addEventListener("error", (event) => {
      const image = event.currentTarget as HTMLImageElement;
      const probe = this.#createProbe(false);
      probe.classList.add("cr-title-probe");
      const fallbackTitle = document.createElement("span");
      fallbackTitle.className = "cr-title-text";
      fallbackTitle.textContent = config.title ?? copy.defaultTitle;
      image.replaceWith(probe, fallbackTitle);
      root.dataset.headerLogo = "false";
    });
    root.dataset.launcherAppearance = config.launcherAppearance ?? "brand";
    root.dataset.agentAvatarStyle = config.agentAvatarStyle ?? "circle";
    const titleLabel = this.#shadow.querySelector<HTMLElement>(".cr-title-text");
    if (titleLabel) titleLabel.textContent = config.title ?? copy.defaultTitle;
    this.#launcher = this.#shadow.querySelector(
      ".cr-launcher",
    ) as HTMLButtonElement;
    const launcherAvatar = this.#shadow.querySelector<HTMLImageElement>(
      ".cr-launcher-avatar",
    );
    launcherAvatar?.addEventListener("error", () => {
      if (launcherAvatar.getAttribute("src") !== this.#config?.launcherAvatarUrl)
        return;
      launcherAvatar.hidden = true;
      this.#shadow.querySelector<HTMLImageElement>(
        ".cr-launcher-icon-open",
      )!.hidden = false;
    });
    this.#fullscreenButton = this.#shadow.querySelector(
      ".cr-fullscreen-toggle",
    ) as HTMLButtonElement;
    this.#messages = this.#shadow.querySelector(
      ".cr-messages",
    ) as HTMLDivElement;
    this.#input = this.#shadow.querySelector(".cr-input") as HTMLInputElement;
    this.#send = this.#shadow.querySelector(".cr-send") as HTMLButtonElement;
    this.#error = this.#shadow.querySelector(
      ".cr-error",
    ) as HTMLParagraphElement;
    this.#status = this.#shadow.querySelector(
      ".cr-status",
    ) as HTMLParagraphElement;
    this.#retry = this.#shadow.querySelector(".cr-retry") as HTMLButtonElement;
    this.#footerLink = this.#shadow.querySelector(
      ".cr-footer a",
    ) as HTMLAnchorElement;
    this.#footerLogo = this.#shadow.querySelector(".powered-by-logo") as HTMLImageElement;
    this.#applyTheme(config);
  }

  #applyTheme(config: WidgetConfig): void {
    const tokens: Array<[string, string | undefined]> = [
      ["--cr-launcher-bg", config.launcherColor ?? "#FF2B67"],
      ["--cr-launcher-fg", config.launcherForeground ?? "#FFFFFF"],
      ["--cr-launcher-avatar-bg", config.launcherAvatarBackground],
      ["--cr-agent-header-start", config.agentHeaderStartColor],
      ["--cr-agent-header-end", config.agentHeaderEndColor],
      ["--cr-header-bg", config.headerBackgroundColor],
      ["--cr-header-fg", config.headerForegroundColor],
      ["--cr-theme-background", config.backgroundColor],
      ["--cr-theme-foreground", config.foregroundColor],
      ["--cr-theme-surface", config.surfaceColor],
      ["--cr-theme-muted", config.mutedColor],
      ["--cr-theme-border", config.borderColor],
    ];
    for (const [name, value] of tokens) {
      if (value) this.style.setProperty(name, value);
      else this.style.removeProperty(name);
    }
    const root = this.#shadow.querySelector<HTMLElement>(".cr-root");
    if (root) root.dataset.headerLogo = String(Boolean(config.headerLogoUrl));
  }

  #createProbe(working: boolean): HTMLSpanElement {
    const avatar = document.createElement("span");
    avatar.className = "cr-probe";
    avatar.dataset.working = String(working);
    const identity = this.#config?.agentIdentity ?? "contextrocket";
    avatar.dataset.identity = this.#config?.agentAvatarUrl ? "custom" : identity;
    avatar.setAttribute("aria-hidden", "true");
    if (this.#config?.agentAvatarUrl) {
      const image = document.createElement("img");
      image.className = "cr-agent-avatar";
      image.src = this.#config.agentAvatarUrl;
      image.alt = "";
      image.loading = "lazy";
      image.decoding = "async";
      avatar.appendChild(image);
    } else if (identity === "probe") {
      avatar.innerHTML = '<svg viewBox="0 0 64 64" focusable="false"><path d="M32 6c11 0 18 7.5 18 18v17c0 7-5.5 12-12.5 12h-11C19.5 53 14 48 14 41V24C14 13.5 21 6 32 6z"/><rect x="17" y="21" width="30" height="10" rx="5" class="cr-probe-visor"/><rect x="34.5" y="23" width="4" height="6" rx=".8" class="cr-probe-eye"/><rect x="22" y="54.5" width="6" height="3.5" rx="1.75" class="cr-probe-foot"/><rect x="36" y="54.5" width="6" height="3.5" rx="1.75" class="cr-probe-foot"/></svg>';
    } else {
      const image = document.createElement("img");
      image.className = "cr-agent-mark";
      image.src = rocketImage("#FFFFFF");
      image.alt = "";
      image.decoding = "async";
      avatar.appendChild(image);
    }
    return avatar;
  }

  async #loadSuggestions(): Promise<void> {
    const config = this.#config;
    if (
      !config ||
      config.mode !== "live" ||
      config.suggestions?.length ||
      !config.apiBaseUrl ||
      !config.handle
    ) {
      this.#suggestionDiscoveryRun += 1;
      this.#suggestionDiscoveryKey = null;
      const hadSuggestions = this.#suggestions.length > 0;
      this.#suggestions = [];
      if (hadSuggestions && !this.#hasUserMessage()) this.#syncUi();
      return;
    }

    const handle = config.handle;
    const apiBaseUrl = config.apiBaseUrl;
    const subjectKind = config.subjectKind ?? "company";
    const discoveryKey = `${apiBaseUrl}\n${subjectKind}\n${handle}`;
    if (this.#suggestionDiscoveryKey === discoveryKey) return;
    this.#suggestionDiscoveryKey = discoveryKey;
    const run = ++this.#suggestionDiscoveryRun;
    const hadSuggestions = this.#suggestions.length > 0;
    this.#suggestions = [];
    if (hadSuggestions && !this.#hasUserMessage()) this.#syncUi();

    try {
      const response = await fetch(
        buildWidgetAgentCardUrl(apiBaseUrl, subjectKind, handle),
        {
          method: "GET",
          mode: "cors",
          credentials: "omit",
          headers: { accept: "application/json" },
        },
      );
      if (run !== this.#suggestionDiscoveryRun) return;
      if (!response.ok) {
        this.#suggestionDiscoveryKey = null;
        return;
      }
      const card: unknown = await response.json();
      if (run !== this.#suggestionDiscoveryRun) return;
      if (!card || typeof card !== "object") {
        this.#suggestionDiscoveryKey = null;
        return;
      }
      const skills = (card as Record<string, unknown>).skills;
      if (!Array.isArray(skills)) {
        this.#suggestionDiscoveryKey = null;
        return;
      }
      const prompts = skills.flatMap((skill) => {
        if (!skill || typeof skill !== "object") return [];
        const examples = (skill as Record<string, unknown>).examples;
        return Array.isArray(examples) ? examples : [];
      }).filter((item): item is string => typeof item === "string")
        .map((item) => item.trim().slice(0, 200))
        .filter(Boolean)
        .slice(0, 5);
      if (prompts.length && !this.#hasUserMessage()) {
        this.#suggestions = prompts;
        this.#syncUi();
      }
    } catch {
      // Card discovery is optional; the localized starter prompts remain available.
      if (run === this.#suggestionDiscoveryRun) {
        // Permit a later configuration update to retry discovery.
        this.#suggestionDiscoveryKey = null;
      }
    }
  }

  #bindEvents(): void {
    this.#launcher.addEventListener("click", () => {
      const isOpen = this.#panel.dataset.open === "true";
      if (!isOpen) this.#setFullscreen(this.#config?.fullscreenOnOpen === true);
      this.#setOpen(!isOpen);
    });
    this.#shadow
      .querySelector(".cr-close")
      ?.addEventListener("click", () => this.#setOpen(false));
    this.#fullscreenButton.addEventListener("click", () =>
      this.#setFullscreen(!this.#fullscreen),
    );
    this.#retry.addEventListener(
      "click",
      () => void this.#sendText(
        this.#lastUserMessage,
        this.#lastUserMessageId,
        this.#lastDemoCard,
      ),
    );
    this.#messages.addEventListener("click", (event) => {
      const target = event.target as HTMLElement;
      const suggestionTab = target.closest<HTMLButtonElement>("[data-suggestion-tab]");
      if (suggestionTab?.dataset.suggestionTab === "questions" || suggestionTab?.dataset.suggestionTab === "cards") {
        const tabId = suggestionTab.dataset.suggestionTab;
        this.#suggestionTab = tabId;
        this.#syncUi();
        this.#messages.querySelector<HTMLButtonElement>(`[data-suggestion-tab="${tabId}"]`)?.focus({ preventScroll: true });
        return;
      }
      const suggestion = target.closest<HTMLButtonElement>("[data-suggestion]");
      if (suggestion?.dataset.suggestion) {
        const demoCard = isWidgetDemoCard(suggestion.dataset.demoCard)
          ? suggestion.dataset.demoCard
          : undefined;
        void this.#sendText(suggestion.dataset.suggestion, undefined, demoCard);
      }
    });
    this.#shadow
      .querySelector(".cr-composer")
      ?.addEventListener("submit", (event) => {
        event.preventDefault();
        if (this.#state.status === "streaming") {
          this.#stopResponse();
        } else {
          void this.#handleSend();
        }
      });
    this.#shadow.addEventListener("keydown", (event) => {
      if (!(event instanceof KeyboardEvent)) return;
      if (!this.#panel || this.#panel.dataset.open !== "true") return;
      if (event.key === "Escape") {
        event.preventDefault();
        if (this.#fullscreen) {
          this.#setFullscreen(false);
          this.#fullscreenButton.focus();
        } else {
          this.#setOpen(false);
        }
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = Array.from(
        this.#panel.querySelectorAll<HTMLElement>(
          [
            'button:not([disabled]):not([hidden])',
            'input:not([disabled]):not([hidden])',
            'a[href]:not([hidden])',
            '[tabindex]:not([tabindex="-1"]):not([hidden])',
          ].join(", "),
        ),
      ).filter((element) => !element.closest("[hidden], [inert]"));
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = this.#shadow.activeElement;
      if (!active || !focusable.includes(active as HTMLElement)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    });
  }

  #setOpen(open: boolean): void {
    if (!this.#panel) return;
    const wasOpen = this.#panel.dataset.open === "true";
    if (!open) this.#setFullscreen(false);
    this.#panel.dataset.open = open ? "true" : "false";
    this.#panel.setAttribute("aria-hidden", String(!open));
    const copy = copyFor(this.#config!);
    this.#launcher.setAttribute("aria-label", open ? copy.close : copy.open);
    if (open) {
      this.#shadow.querySelector<HTMLElement>(".cr-root")?.style.removeProperty("--cr-fab-lift");
      void this.#loadSuggestions();
      this.#panel.removeAttribute("inert");
      this.#launcher.setAttribute("aria-expanded", "true");
      (this.#input.disabled ? this.#send : this.#input).focus();
    } else {
      this.#panel.setAttribute("inert", "");
      this.#launcher.setAttribute("aria-expanded", "false");
      this.#scheduleLauncherPlacement();
      if (wasOpen) this.#launcher.focus();
    }
  }

  #setFullscreen(fullscreen: boolean): void {
    if (!this.#panel) return;
    const enabled = this.#config?.fullscreen || this.#config?.fullscreenOnOpen || this.#config?.fullscreenOnLoad;
    this.#fullscreen = Boolean(fullscreen && enabled);
    const root = this.#shadow.querySelector<HTMLElement>(".cr-root");
    if (root) root.dataset.fullscreen = String(this.#fullscreen);
    this.#panel.dataset.fullscreen = String(this.#fullscreen);
    if (!this.#fullscreenButton) return;
    const copy = copyFor(this.#config!);
    this.#fullscreenButton.setAttribute(
      "aria-label",
      this.#fullscreen ? copy.collapse : copy.expand,
    );
    this.#fullscreenButton.setAttribute(
      "aria-pressed",
      String(this.#fullscreen),
    );
    const expandIcon = this.#fullscreenButton.querySelector(
      ".cr-fullscreen-expand-icon",
    );
    const collapseIcon = this.#fullscreenButton.querySelector(
      ".cr-fullscreen-collapse-icon",
    );
    if (this.#fullscreen) {
      expandIcon?.setAttribute("hidden", "");
      collapseIcon?.removeAttribute("hidden");
    } else {
      expandIcon?.removeAttribute("hidden");
      collapseIcon?.setAttribute("hidden", "");
    }
    this.#launcher.hidden = this.#fullscreen;
    this.#scheduleLauncherPlacement();
  }

  async #handleSend(): Promise<void> {
    const text = this.#input.value.trim();
    if (!text) return;
    this.#input.value = "";
    await this.#sendText(text);
  }

  async #sendText(
    text: string,
    messageId?: string,
    demoCard?: WidgetDemoCard,
  ): Promise<void> {
    const config = this.#config;
    if (!config || !text.trim() || !canSend(this.#state)) return;

    this.#lastUserMessage = text.trim();
    this.#lastUserMessageId = messageId ?? crypto.randomUUID();
    this.#lastDemoCard = demoCard;
    const started = beginSend(this.#state, this.#lastUserMessage);
    this.#state = started.state;
    this.#assistantMessageId = started.assistantMessageId;
    this.#forceMessagesToBottom = true;
    const runId = ++this.#runId;
    const controller = new AbortController();
    this.#abortController = controller;
    this.#syncUi();
    // The input is disabled while a response streams, and opening suggestion
    // buttons are replaced during rendering. Keep focus inside the dialog.
    this.#send.focus();

    try {
      for await (const event of streamEmbedA2aSubscribe(
        config,
        {
          message: this.#lastUserMessage,
          messageId: this.#lastUserMessageId,
          threadId: this.#state.threadId ?? undefined,
          demoCard: this.#lastDemoCard,
        },
        undefined,
        controller.signal,
      )) {
        if (runId !== this.#runId) return;
        this.#state = applyTransportEvent(
          this.#state,
          event,
          started.assistantMessageId,
        );
        this.#syncUi();
        if (
          event.type === "error" ||
          event.type === "unsupported" ||
          event.type === "done"
        )
          break;
      }
    } catch {
      if (runId === this.#runId) {
        this.#state = {
          ...this.#state,
          status: "error",
          errorMessage: null,
          errorReason: "generic",
        };
        this.#syncUi();
      }
    } finally {
      if (runId === this.#runId) this.#abortController = null;
    }
  }

  #stopResponse(): void {
    this.#abortController?.abort();
    this.#runId += 1;
    this.#abortController = null;
    this.#state = {
      ...this.#state,
      status: "canceled",
      errorMessage: copyFor(this.#config!).canceled,
      errorReason: null,
    };
    this.#syncUi();
  }

  #syncUi(): void {
    if (!this.#config) return;
    const copy = copyFor(this.#config);
    const previousScrollTop = this.#messages.scrollTop;
    const distanceFromBottom =
      this.#messages.scrollHeight -
      this.#messages.clientHeight -
      previousScrollTop;
    const shouldFollowOutput =
      this.#forceMessagesToBottom ||
      distanceFromBottom <= CHAT_SCROLL_BOTTOM_THRESHOLD;
    const headerProbe = this.#shadow.querySelector<HTMLElement>(".cr-title-probe");
    if (headerProbe) headerProbe.dataset.working = String(this.#state.status === "streaming");
    this.#forceMessagesToBottom = false;
    this.#messages.replaceChildren();

    const hasUserMessage = this.#hasUserMessage();
    this.#messages.dataset.welcome = String(!hasUserMessage);
    if (this.#state.messages.length === 0) {
      const empty = document.createElement("div");
      empty.className = "cr-empty";
      empty.dataset.suggestionsView = this.#suggestionTab;
      const probe = this.#createProbe(false);
      probe.classList.add("cr-probe-large");
      const title = document.createElement("h3");
      title.textContent = copy.emptyTitle;
      const description = document.createElement("p");
      description.textContent = copy.emptyDescription;
      if (this.#config.agentAvatarUrl || this.#config.agentIdentity === "probe") {
        empty.appendChild(probe);
      }
      empty.append(title, description, this.#renderOpeningSuggestions(copy));
      this.#messages.appendChild(empty);
    }

    const firstWelcomeMessageId = !hasUserMessage
      ? this.#state.messages.find((message) => message.role === "assistant" && message.content.trim())?.id
      : undefined;
    for (const message of this.#state.messages) {
      if (
        message.role === "assistant" &&
        !message.content.trim() &&
        !message.sourceRefs?.length &&
        !message.suggestions?.length &&
        !message.responseSpec &&
        !message.responseUnavailable &&
        !(
          this.#state.status === "streaming" &&
          message.id === this.#assistantMessageId
        )
      )
        continue;
      const bubble = document.createElement("div");
      bubble.className = "cr-message";
      bubble.dataset.role = message.role;
      const isOpeningAssistant = message.role === "assistant" && message.id === firstWelcomeMessageId;
      if (isOpeningAssistant) bubble.dataset.welcome = "true";
      if (message.role === "assistant") {
        if (!isOpeningAssistant) bubble.appendChild(this.#createProbe(this.#state.status === "streaming" && message.id === this.#assistantMessageId));
        renderMarkdown(bubble, message.content);
        if (message.responseSpec) this.#renderAgentResponse(bubble, message.responseSpec);
        if (message.responseUnavailable) {
          const unavailable = document.createElement("p");
          unavailable.className = "cr-unavailable";
          unavailable.textContent = copy.unavailable;
          bubble.appendChild(unavailable);
        }
        if (message.sourceRefs?.length)
          this.#renderSources(bubble, message.sourceRefs, copy);
        if (message.suggestions?.length && this.#state.status !== "streaming") {
          this.#renderSuggestions(bubble, message.suggestions, copy);
        }
      } else {
        bubble.textContent = message.content;
      }
      if (
        message.role === "assistant" &&
        this.#state.status === "streaming" &&
        message.id === this.#assistantMessageId
      ) {
        bubble.dataset.streaming = "true";
      }
      this.#messages.appendChild(bubble);
    }

    // A configured greeting is an assistant message, but the visitor has not
    // started a conversation yet. Keep the opening suggestions available
    // until their first message so greetings do not hide the demo entry point.
    if (hasUserMessage === false && this.#state.messages.length > 0) {
      this.#messages.appendChild(this.#renderOpeningSuggestions(copy));
    }

    this.#messages.scrollTop = shouldFollowOutput
      ? this.#messages.scrollHeight
      : previousScrollTop;
    const errorCopy =
      this.#state.status === "error"
        ? this.#state.errorReason === "interrupted"
          ? copy.interrupted
          : this.#state.errorReason === "unsupported"
            ? copy.unsupported
            : copy.generic
        : this.#state.status === "canceled"
          ? copy.canceled
          : "";
    const hasError = Boolean(errorCopy);
    this.#error.hidden = !hasError;
    this.#error.textContent = errorCopy;
    this.#retry.hidden = !hasError || !this.#lastUserMessage;

    let statusText = "";
    if (this.#state.status === "streaming") {
      statusText =
        this.#state.transportState === "submitted"
          ? copy.submitted
          : copy.working;
    } else if (this.#state.status === "input-required") {
      statusText = copy.inputRequired;
    }
    this.#status.hidden = !statusText;
    this.#status.textContent = statusText;

    const sending = this.#state.status === "streaming";
    this.#messages.setAttribute("aria-busy", String(sending));
    this.#input.disabled = sending;
    this.#send.disabled = !sending && !canSend(this.#state);
    // Visual is CSS (::before arrow/stop); keep label for a11y only.
    this.#send.textContent = "";
    this.#send.dataset.state = sending ? "stop" : "send";
    this.#send.setAttribute("aria-label", sending ? copy.stop : copy.send);
  }

  #hasUserMessage(): boolean {
    return this.#state.messages.some((message) => message.role === "user");
  }

  #renderOpeningSuggestions(copy: WidgetCopy): HTMLDivElement {
    const wrap = document.createElement("div");
    wrap.className = "cr-opening-suggestions";
    const tabs = document.createElement("div");
    tabs.className = "cr-suggestion-tabs";
    tabs.setAttribute("role", "group");
    tabs.setAttribute("aria-label", copy.suggestionGroup);
    const tabOptions = [
      { id: "questions" as const, label: copy.suggestionPrompts },
      { id: "cards" as const, label: copy.suggestionCards },
    ];
    for (const option of tabOptions) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "cr-suggestion-tab";
      button.dataset.suggestionTab = option.id;
      button.setAttribute("aria-pressed", String(this.#suggestionTab === option.id));
      button.textContent = option.label;
      tabs.appendChild(button);
    }
    const configuredSuggestions = this.#config?.suggestions;
    const questionSuggestions = configuredSuggestions?.length
      ? configuredSuggestions
      : this.#suggestions.length
        ? this.#suggestions
        : copy.defaultSuggestions;
    const prompts = this.#suggestionTab === "questions"
      ? questionSuggestions.map((label) => ({ label }))
      : copy.componentSuggestions;
    const list = document.createElement("div");
    list.className = "cr-suggestion-items";
    list.dataset.view = this.#suggestionTab;
    for (const prompt of prompts) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "cr-suggestion";
      button.dataset.suggestion = prompt.label;
      if ("component" in prompt && prompt.component) {
        button.dataset.demoCard = prompt.component;
      }
      button.textContent = prompt.label;
      list.appendChild(button);
    }
    wrap.append(tabs, list);
    return wrap;
  }

  #renderAgentResponse(bubble: HTMLDivElement, spec: NonNullable<WidgetChatState["messages"][number]["responseSpec"]>): void {
    const copy = copyFor(this.#config!);
    const region = document.createElement("section");
    region.className = "cr-agent-response";
    for (const id of spec.elements.response.children) {
      const element = spec.elements[id];
      const card = document.createElement("article");
      card.className = `cr-agent-card cr-agent-card-${element.type.toLowerCase()}`;
      if (element.type === "Progress") {
        const heading = document.createElement("strong"); heading.textContent = element.props.stage; card.appendChild(heading);
        if (typeof element.props.total === "number") { const count = document.createElement("span"); count.textContent = `${element.props.completed} / ${element.props.total}`; card.appendChild(count); }
      } else if (element.type === "Evidence") {
        const heading = document.createElement("strong"); heading.textContent = copy.evidence; card.appendChild(heading);
        for (const ref of element.props.refs) { const item = document.createElement("div"); item.className = "cr-agent-evidence"; const title = document.createElement("strong"); title.textContent = ref.title; item.appendChild(title); if (ref.excerpt) { const excerpt = document.createElement("p"); excerpt.textContent = ref.excerpt; item.appendChild(excerpt); } card.appendChild(item); }
      } else if (element.type === "Question") {
        const heading = document.createElement("strong"); heading.textContent = copy.question; card.append(heading, document.createTextNode(element.props.question));
      } else if (element.type === "ProposalBatch") {
        const heading = document.createElement("strong"); heading.textContent = copy.proposals; card.appendChild(heading);
        for (const view of element.props.views) { const item = document.createElement("p"); item.textContent = view.summary; card.appendChild(item); }
      } else if (element.type === "Representation") {
        const heading = document.createElement("strong"); heading.textContent = copy.representation; card.appendChild(heading);
      }
      region.appendChild(card);
    }
    bubble.appendChild(region);
  }

  #renderSources(
    bubble: HTMLDivElement,
    refs: NonNullable<WidgetChatState["messages"][number]["sourceRefs"]>,
    copy: WidgetCopy,
  ): void {
    const region = document.createElement("div");
    region.className = "cr-sources";
    region.setAttribute("aria-label", copy.sources);
    for (const ref of refs) {
      const href = safeHref(ref.url);
      const item = href
        ? document.createElement("a")
        : document.createElement("span");
      item.className = "cr-source";
      item.textContent = ref.title ?? ref.sourceRefId;
      if (href && item instanceof HTMLAnchorElement) {
        item.href = href;
        item.target = "_blank";
        item.rel = "noopener noreferrer";
      }
      region.appendChild(item);
    }
    bubble.appendChild(region);
  }

  #renderSuggestions(
    bubble: HTMLDivElement,
    suggestions: string[],
    copy: WidgetCopy,
  ): void {
    const region = document.createElement("div");
    region.className = "cr-suggestions";
    region.setAttribute("aria-label", copy.suggestions);
    const label = document.createElement("span");
    label.className = "cr-suggestions-label";
    label.setAttribute("aria-hidden", "true");
    label.textContent = copy.suggestions;
    region.appendChild(label);
    for (const suggestion of suggestions) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "cr-suggestion";
      button.dataset.suggestion = suggestion;
      button.textContent = suggestion;
      region.appendChild(button);
    }
    bubble.appendChild(region);
  }
}

export function registerContextRocketChatElement(
  registry: CustomElementRegistry = customElements,
): void {
  if (!registry.get(ELEMENT_TAG))
    registry.define(ELEMENT_TAG, ContextRocketChatElement);
}

export function findEmbedScriptTag(
  current: HTMLScriptElement | null = document.currentScript as HTMLScriptElement | null,
): HTMLScriptElement | null {
  if (current) return current;
  const scripts = document.querySelectorAll<HTMLScriptElement>(
    'script[src*="embed/widget.js"], script[data-contextrocket-api-key], script[data-contextrocket-handle]',
  );
  for (let index = scripts.length - 1; index >= 0; index -= 1) {
    const candidate = scripts.item(index);
    if (candidate && parseWidgetConfig(candidate)) return candidate;
  }
  return null;
}

export function mountFromScriptTag(
  script: HTMLScriptElement | null = findEmbedScriptTag(),
): ContextRocketChatElement | null {
  if (!script) return null;
  const config = parseWidgetConfig(script);
  if (!config) {
    console.warn(
      "[ContextRocket] live embed requires data-contextrocket-api-base; omit data-contextrocket-mode for a canned demo",
    );
    return null;
  }
  registerContextRocketChatElement();
  const host = document.createElement(ELEMENT_TAG) as ContextRocketChatElement;
  for (const attr of script.attributes) {
    if (attr.name.startsWith("data-")) host.setAttribute(attr.name, attr.value);
  }
  document.body.appendChild(host);
  return host;
}
