import { resolveWidgetLocale } from "./copy";
import type { WidgetConfig } from "./types";

const DATA_PREFIX = "contextrocket";
const MAX_TITLE_LENGTH = 120;
const MAX_GREETING_LENGTH = 400;
const MAX_REF_LENGTH = 100;

function readAttr(element: Element, ...names: string[]): string | undefined {
  for (const name of names) {
    const value = element.getAttribute(name)?.trim();
    if (value) {
      return value;
    }
  }
  return undefined;
}

function readBooleanAttr(element: Element, name: string): boolean {
  return ["true", "1", "yes"].includes(
    element.getAttribute(name)?.trim().toLowerCase() ?? "",
  );
}

function boundedText(
  value: string | undefined,
  maxLength: number,
): string | undefined {
  if (!value) return undefined;
  const normalized = value.replace(/[\u0000-\u001f\u007f]/g, "").trim();
  return normalized ? normalized.slice(0, maxLength) : undefined;
}

function safeAccent(value: string | undefined): string | undefined {
  if (!value) return undefined;
  // Keep the value a CSS color token, never a declaration or a URL. The
  // browser still owns final contrast handling; invalid values use the
  // starter default.
  return /^(#[0-9a-f]{3,8}|rgb(a)?\([^)]{1,80}\)|hsl(a)?\([^)]{1,80}\))$/i.test(
    value,
  )
    ? value
    : undefined;
}

/**
 * Parse widget configuration from a script tag or host element.
 *
 * Attribute names are deliberately namespaced so snippets are unambiguous:
 * `data-contextrocket-api-key`, `data-contextrocket-handle`, and so on.
 */
export function parseWidgetConfig(source: Element): WidgetConfig | null {
  const apiKey = readAttr(source, `data-${DATA_PREFIX}-api-key`);
  const handle = readAttr(source, `data-${DATA_PREFIX}-handle`);
  const apiBaseUrl = readAttr(source, `data-${DATA_PREFIX}-api-base`);
  const rawMode = readAttr(source, `data-${DATA_PREFIX}-mode`);
  const mode = rawMode === "live" ? "live" : "demo";

  // Demo mode is self-contained. Live mode requires an API base; ContextRocket
  // decides whether the handle/key is authorized for the requested origin.
  if (mode === "live" && !apiBaseUrl) {
    return null;
  }

  const accentColor = readAttr(source, `data-${DATA_PREFIX}-accent`);
  const greeting = readAttr(source, `data-${DATA_PREFIX}-greeting`);
  const title = readAttr(source, `data-${DATA_PREFIX}-title`);
  const ref = readAttr(source, `data-${DATA_PREFIX}-ref`);
  const rawPosition = readAttr(source, `data-${DATA_PREFIX}-position`);
  const rawLocale = readAttr(source, `data-${DATA_PREFIX}-locale`);
  const rawPoweredByLogo = readAttr(source, `data-${DATA_PREFIX}-powered-by-logo`);
  const rawSuggestions = readAttr(source, `data-${DATA_PREFIX}-suggestions`);
  let suggestions: string[] | undefined;
  if (rawSuggestions) {
    try {
      const value: unknown = JSON.parse(rawSuggestions);
      if (Array.isArray(value)) {
        const parsed = value
          .filter((item): item is string => typeof item === "string")
          .map((item) => item.trim().slice(0, 200))
          .filter(Boolean)
          .slice(0, 5);
        if (parsed.length) suggestions = parsed;
      }
    } catch { /* Invalid optional installation copy falls back to card examples. */ }
  }
  const themeColors = {
    backgroundColor: readAttr(source, `data-${DATA_PREFIX}-background`),
    foregroundColor: readAttr(source, `data-${DATA_PREFIX}-foreground`),
    surfaceColor: readAttr(source, `data-${DATA_PREFIX}-surface`),
    mutedColor: readAttr(source, `data-${DATA_PREFIX}-muted`),
    borderColor: readAttr(source, `data-${DATA_PREFIX}-border`),
  };

  return {
    ...(apiBaseUrl ? { apiBaseUrl: apiBaseUrl.replace(/\/$/, "") } : {}),
    mode,
    ...(apiKey ? { apiKey } : {}),
    ...(handle ? { handle } : {}),
    ...(safeAccent(accentColor)
      ? { accentColor: safeAccent(accentColor) }
      : {}),
    ...(boundedText(greeting, MAX_GREETING_LENGTH)
      ? { greeting: boundedText(greeting, MAX_GREETING_LENGTH) }
      : {}),
    ...(boundedText(title, MAX_TITLE_LENGTH)
      ? { title: boundedText(title, MAX_TITLE_LENGTH) }
      : {}),
    ...(boundedText(ref, MAX_REF_LENGTH)
      ? { ref: boundedText(ref, MAX_REF_LENGTH) }
      : {}),
    ...Object.fromEntries(Object.entries(themeColors).flatMap(([key, value]) => safeAccent(value) ? [[key, safeAccent(value)]] : [])),
    ...(rawPoweredByLogo === "ink" || rawPoweredByLogo === "white" ? { poweredByLogo: rawPoweredByLogo } : {}),
    ...(suggestions ? { suggestions } : {}),
    ...(rawPosition === "bottom-right" || rawPosition === "bottom-left"
      ? { position: rawPosition }
      : {}),
    ...(readBooleanAttr(source, `data-${DATA_PREFIX}-fullscreen`)
      ? { fullscreen: true }
      : {}),
    ...(readBooleanAttr(source, `data-${DATA_PREFIX}-fullscreen-on-open`)
      ? { fullscreenOnOpen: true }
      : {}),
    ...(readBooleanAttr(source, `data-${DATA_PREFIX}-fullscreen-on-load`)
      ? { fullscreenOnLoad: true }
      : {}),
    locale: resolveWidgetLocale(
      rawLocale,
      source.ownerDocument.documentElement.lang,
    ),
  };
}

export function buildPoweredByHref(config: WidgetConfig): string {
  // The "powered by ContextRocket" backlink points at the website
  // (contextrocket.com), never the API domain.
  const base = "https://contextrocket.com";
  const refToken = config.ref ?? config.handle ?? "widget";
  return `${base}?ref=${encodeURIComponent(refToken)}`;
}
