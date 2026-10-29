import { streamEmbedA2aSubscribe } from "./a2a-transport";
import {
  applyTransportEvent,
  beginSend,
  canSend,
  createInitialChatState,
  type WidgetChatState,
} from "./chat-state";
import { buildPoweredByHref, parseWidgetConfig } from "./config";
import { renderMarkdown } from "./markdown";
import { safeHref, escapeHtml } from "./safe-url";
import { widgetStyles } from "./styles";
import type { WidgetConfig } from "./types";
import { copyFor, type WidgetCopy } from "./copy";

const ELEMENT_TAG = "contextrocket-chat";

export class ContextRocketChatElement extends HTMLElement {
  #config: WidgetConfig | null = null;
  #state: WidgetChatState = createInitialChatState();
  #shadow: ShadowRoot;
  #runId = 0;
  #assistantMessageId: string | null = null;
  #lastUserMessage = "";
  #lastUserMessageId: string | undefined;
  #abortController: AbortController | null = null;

  #launcher!: HTMLButtonElement;
  #panel!: HTMLDivElement;
  #messages!: HTMLDivElement;
  #input!: HTMLInputElement;
  #send!: HTMLButtonElement;
  #error!: HTMLParagraphElement;
  #status!: HTMLParagraphElement;
  #retry!: HTMLButtonElement;
  #footerLink!: HTMLAnchorElement;

  static get observedAttributes(): string[] {
    return [
      "data-contextrocket-api-key",
      "data-contextrocket-handle",
      "data-contextrocket-mode",
      "data-contextrocket-api-base",
      "data-contextrocket-accent",
      "data-contextrocket-greeting",
      "data-contextrocket-title",
      "data-contextrocket-ref",
      "data-contextrocket-theme",
      "data-contextrocket-position",
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
    this.#bindEvents();
    this.#syncUi();
    this.#setOpen(false);
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
    this.#shadow.querySelector<HTMLElement>(".cr-title")!.textContent =
      next.title ?? copy.defaultTitle;
    this.#panel.setAttribute("aria-label", next.title ?? copy.defaultTitle);
    this.#shadow
      .querySelector(".cr-close")!
      .setAttribute("aria-label", copy.close);
    this.#launcher.setAttribute(
      "aria-label",
      this.#panel.dataset.open === "true" ? copy.close : copy.open,
    );
    this.#input.placeholder = copy.placeholder;
    this.#input.setAttribute("aria-label", copy.placeholder);
    this.#retry.textContent = copy.retry;
    this.#footerLink.querySelector("span")!.textContent = copy.poweredBy;
    this.#syncUi();
    this.#footerLink.href = buildPoweredByHref(next);
    this.style.setProperty("--cr-accent", next.accentColor ?? "#ff2b67");
    this.dataset.theme = next.theme ?? "system";
    this.#shadow
      .querySelector<HTMLElement>(".cr-root")
      ?.setAttribute("data-position", next.position ?? "bottom-right");
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
    root.innerHTML = `
      <div class="cr-panel" data-open="false" data-position="${escapeHtml(config.position ?? "bottom-right")}" part="panel" role="dialog" aria-modal="true" aria-hidden="true" aria-label="${escapeHtml(config.title ?? copy.defaultTitle)}" inert>
        <header class="cr-header">
          <h2 class="cr-title">${escapeHtml(config.title ?? copy.defaultTitle)}</h2>
          <button type="button" class="cr-close" aria-label="${copy.close}">×</button>
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
          <a class="powered-by-badge" href="${escapeHtml(buildPoweredByHref(config))}" target="_blank" rel="noopener noreferrer">
            <img src="/brand/cr-icon-red.svg" alt="" width="14" height="14" aria-hidden="true">
            <span>${escapeHtml(copy.poweredBy)}</span>
          </a>
        </footer>
      </div>
      <button type="button" class="cr-launcher" aria-label="${copy.open}" aria-expanded="false" aria-controls="contextrocket-chat-panel" part="launcher">
        <svg class="cr-launcher-icon-open" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/></svg>
        <svg class="cr-launcher-icon-close" hidden xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
      </button>
    `;

    this.#shadow.replaceChildren(style, root);
    this.#panel = this.#shadow.querySelector(".cr-panel") as HTMLDivElement;
    this.#panel.id = "contextrocket-chat-panel";
    this.#launcher = this.#shadow.querySelector(
      ".cr-launcher",
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
    this.dataset.theme = config.theme ?? "system";
  }

  #bindEvents(): void {
    this.#launcher.addEventListener("click", () => {
      const isOpen = this.#panel.dataset.open === "true";
      this.#setOpen(!isOpen);
    });
    this.#shadow
      .querySelector(".cr-close")
      ?.addEventListener("click", () => this.#setOpen(false));
    this.#retry.addEventListener(
      "click",
      () => void this.#sendText(this.#lastUserMessage, this.#lastUserMessageId),
    );
    this.#messages.addEventListener("click", (event) => {
      const target = event.target as HTMLElement;
      const suggestion = target.closest<HTMLButtonElement>("[data-suggestion]");
      if (suggestion?.dataset.suggestion)
        void this.#sendText(suggestion.dataset.suggestion);
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
        this.#setOpen(false);
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = Array.from(
        this.#panel.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
        ),
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && this.#shadow.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && this.#shadow.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    });
  }

  #setOpen(open: boolean): void {
    if (!this.#panel) return;
    this.#panel.dataset.open = open ? "true" : "false";
    this.#panel.setAttribute("aria-hidden", String(!open));
    const openIcon = this.#launcher.querySelector(
      ".cr-launcher-icon-open",
    ) as HTMLElement | null;
    const closeIcon = this.#launcher.querySelector(
      ".cr-launcher-icon-close",
    ) as HTMLElement | null;
    // SVG elements do not reliably reflect the `hidden` IDL property onto the
    // attribute, and our CSS keys off [hidden]. Toggle the attribute explicitly.
    if (openIcon && closeIcon) {
      if (open) {
        openIcon.setAttribute("hidden", "");
        closeIcon.removeAttribute("hidden");
      } else {
        openIcon.removeAttribute("hidden");
        closeIcon.setAttribute("hidden", "");
      }
    }
    const copy = copyFor(this.#config!);
    this.#launcher.setAttribute("aria-label", open ? copy.close : copy.open);
    if (open) {
      this.#panel.removeAttribute("inert");
      this.#launcher.setAttribute("aria-expanded", "true");
      this.#input.focus();
    } else {
      this.#panel.setAttribute("inert", "");
      this.#launcher.setAttribute("aria-expanded", "false");
      this.#launcher.focus();
    }
  }

  async #handleSend(): Promise<void> {
    const text = this.#input.value.trim();
    if (!text) return;
    this.#input.value = "";
    await this.#sendText(text);
  }

  async #sendText(text: string, messageId?: string): Promise<void> {
    const config = this.#config;
    if (!config || !text.trim() || !canSend(this.#state)) return;

    this.#lastUserMessage = text.trim();
    this.#lastUserMessageId = messageId ?? crypto.randomUUID();
    const started = beginSend(this.#state, this.#lastUserMessage);
    this.#state = started.state;
    this.#assistantMessageId = started.assistantMessageId;
    const runId = ++this.#runId;
    const controller = new AbortController();
    this.#abortController = controller;
    this.#syncUi();

    try {
      for await (const event of streamEmbedA2aSubscribe(
        config,
        {
          message: this.#lastUserMessage,
          messageId: this.#lastUserMessageId,
          threadId: this.#state.threadId ?? undefined,
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
    this.#messages.replaceChildren();

    for (const message of this.#state.messages) {
      if (
        message.role === "assistant" &&
        !message.content.trim() &&
        !message.sourceRefs?.length &&
        !message.suggestions?.length &&
        !(
          this.#state.status === "streaming" &&
          message.id === this.#assistantMessageId
        )
      )
        continue;
      const bubble = document.createElement("div");
      bubble.className = "cr-message";
      bubble.dataset.role = message.role;
      if (message.role === "assistant") {
        renderMarkdown(bubble, message.content);
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

    this.#messages.scrollTop = this.#messages.scrollHeight;
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
    this.#input.disabled = sending;
    this.#send.disabled = !sending && !canSend(this.#state);
    // Visual is CSS (::before arrow/stop); keep label for a11y only.
    this.#send.textContent = "";
    this.#send.dataset.state = sending ? "stop" : "send";
    this.#send.setAttribute("aria-label", sending ? copy.stop : copy.send);
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
