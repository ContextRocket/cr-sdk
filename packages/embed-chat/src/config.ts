import { resolveWidgetLocale } from "./copy";
import type { WidgetConfig, WidgetSubjectKind } from "./types";

const DATA_PREFIX = "contextrocket";
const MAX_TITLE_LENGTH = 120;
const MAX_GREETING_LENGTH = 400;
const MAX_REF_LENGTH = 100;
const ROCKET_PINK = "#FF2B67";
const INK = "#0E0F13";
const WHITE = "#FFFFFF";
const MAX_AVATAR_URL_LENGTH = 2048;

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

function safeAvatarUrl(value: string | undefined, baseUri: string): string | undefined {
  if (!value || value.length > MAX_AVATAR_URL_LENGTH) return undefined;
  try {
    const url = new URL(value, baseUri);
    if (url.protocol !== "https:" && url.protocol !== "http:") return undefined;
    return value;
  } catch {
    return undefined;
  }
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

function normalizedHex(value: string): string | undefined {
  const hex = value.trim();
  if (/^#[0-9a-f]{3}$/i.test(hex))
    return `#${hex.slice(1).split("").map((part) => part + part).join("").toUpperCase()}`;
  if (/^#[0-9a-f]{6}$/i.test(hex)) return hex.toUpperCase();
  return undefined;
}

function luminance(hex: string): number {
  const channels = [1, 3, 5].map((offset) => {
    const channel = Number.parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

function contrastRatio(first: string, second: string): number {
  const values = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

function resolveLauncherPalette(value: string | undefined): {
  background: string;
  foreground: string;
} {
  const normalized = value?.trim();
  if (!normalized || normalized.toLowerCase() === "pink")
    return { background: ROCKET_PINK, foreground: WHITE };
  if (normalized.toLowerCase() === "ink")
    return { background: INK, foreground: WHITE };

  const custom = normalizedHex(normalized);
  if (!custom) return { background: INK, foreground: WHITE };
  if (contrastRatio(custom, WHITE) >= 3)
    return { background: custom, foreground: WHITE };
  if (contrastRatio(custom, INK) >= 3)
    return { background: custom, foreground: INK };
  return { background: INK, foreground: WHITE };
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
  const rawSubjectKind = readAttr(source, `data-${DATA_PREFIX}-subject-kind`);
  const subjectKind: WidgetSubjectKind =
    rawSubjectKind === "person" ? "person" : "company";
  const apiBaseUrl = readAttr(source, `data-${DATA_PREFIX}-api-base`);
  const rawMode = readAttr(source, `data-${DATA_PREFIX}-mode`);
  const mode = rawMode === "live" ? "live" : "demo";

  // Demo mode is self-contained. Live mode requires an API base; ContextRocket
  // decides whether the handle/key is authorized for the requested origin.
  if (mode === "live" && !apiBaseUrl) {
    return null;
  }

  const accentColor = readAttr(source, `data-${DATA_PREFIX}-accent`);
  const launcherPalette = resolveLauncherPalette(
    readAttr(source, `data-${DATA_PREFIX}-launcher-color`),
  );
  const greeting = readAttr(source, `data-${DATA_PREFIX}-greeting`);
  const title = readAttr(source, `data-${DATA_PREFIX}-title`);
  const subtitle = readAttr(source, `data-${DATA_PREFIX}-subtitle`);
  const rawLauncherAppearance = readAttr(source, `data-${DATA_PREFIX}-launcher-appearance`);
  const rawAgentAvatarStyle = readAttr(source, `data-${DATA_PREFIX}-agent-avatar-style`);
  const agentHeaderStartColor = readAttr(source, `data-${DATA_PREFIX}-agent-header-start`);
  const agentHeaderEndColor = readAttr(source, `data-${DATA_PREFIX}-agent-header-end`);
  const launcherAvatarBackground = readAttr(source, `data-${DATA_PREFIX}-launcher-avatar-background`);
  const agentAvatarUrl = readAttr(source, `data-${DATA_PREFIX}-agent-avatar`);
  const launcherAvatarUrl = readAttr(source, `data-${DATA_PREFIX}-launcher-avatar`);
  const ref = readAttr(source, `data-${DATA_PREFIX}-ref`);
  const rawPosition = readAttr(source, `data-${DATA_PREFIX}-position`);
  const rawLocale = readAttr(source, `data-${DATA_PREFIX}-locale`);
  const rawPoweredByLogo = readAttr(source, `data-${DATA_PREFIX}-powered-by-logo`);
  const consentGate = readBooleanAttr(source, `data-${DATA_PREFIX}-consent-gate`);
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
    subjectKind,
    ...(safeAccent(accentColor)
      ? { accentColor: safeAccent(accentColor) }
      : {}),
    launcherColor: launcherPalette.background,
    launcherForeground: launcherPalette.foreground,
    ...(boundedText(greeting, MAX_GREETING_LENGTH)
      ? { greeting: boundedText(greeting, MAX_GREETING_LENGTH) }
      : {}),
    ...(boundedText(title, MAX_TITLE_LENGTH)
      ? { title: boundedText(title, MAX_TITLE_LENGTH) }
      : {}),
    ...(boundedText(subtitle, MAX_TITLE_LENGTH)
      ? { subtitle: boundedText(subtitle, MAX_TITLE_LENGTH) }
      : {}),
    ...(rawLauncherAppearance === "portrait" ? { launcherAppearance: "portrait" as const } : {}),
    ...(safeAccent(launcherAvatarBackground) || launcherAvatarBackground?.toLowerCase() === "transparent"
      ? { launcherAvatarBackground: launcherAvatarBackground!.toLowerCase() === "transparent" ? "transparent" : safeAccent(launcherAvatarBackground) }
      : {}),
    ...(rawAgentAvatarStyle === "cutout" ? { agentAvatarStyle: "cutout" as const } : {}),
    ...(safeAccent(agentHeaderStartColor) ? { agentHeaderStartColor: safeAccent(agentHeaderStartColor) } : {}),
    ...(safeAccent(agentHeaderEndColor) ? { agentHeaderEndColor: safeAccent(agentHeaderEndColor) } : {}),
    ...(safeAvatarUrl(agentAvatarUrl, source.ownerDocument.baseURI)
      ? { agentAvatarUrl: safeAvatarUrl(agentAvatarUrl, source.ownerDocument.baseURI) }
      : {}),
    ...(safeAvatarUrl(launcherAvatarUrl, source.ownerDocument.baseURI)
      ? { launcherAvatarUrl: safeAvatarUrl(launcherAvatarUrl, source.ownerDocument.baseURI) }
      : {}),
    ...(boundedText(ref, MAX_REF_LENGTH)
      ? { ref: boundedText(ref, MAX_REF_LENGTH) }
      : {}),
    ...Object.fromEntries(Object.entries(themeColors).flatMap(([key, value]) => safeAccent(value) ? [[key, safeAccent(value)]] : [])),
    ...(rawPoweredByLogo === "ink" || rawPoweredByLogo === "white" ? { poweredByLogo: rawPoweredByLogo } : {}),
    ...(consentGate ? { consentGate: true } : {}),
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

export function buildWidgetA2aUrl(config: WidgetConfig): string | null {
  if (!config.apiBaseUrl) return null;
  const base = config.apiBaseUrl.replace(/\/$/, "");
  if (!config.handle) return `${base}/a2a`;
  const subjectKind = config.subjectKind ?? "company";
  return `${base}/${subjectKind}/${encodeURIComponent(config.handle)}/a2a`;
}

export function buildWidgetAgentCardUrl(
  apiBaseUrl: string,
  subjectKind: WidgetSubjectKind,
  handle: string,
): string {
  return `${apiBaseUrl.replace(/\/$/, "")}/${subjectKind}/${encodeURIComponent(handle)}/agent-card.json`;
}

export function buildPoweredByHref(config: WidgetConfig): string {
  // The "powered by ContextRocket" backlink points at the website
  // (contextrocket.com), never the API domain.
  const base = "https://contextrocket.com";
  const refToken = config.ref ?? config.handle ?? "widget";
  return `${base}?ref=${encodeURIComponent(refToken)}`;
}
