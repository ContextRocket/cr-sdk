import { describe, expect, it } from "vitest";
import { parseWidgetConfig } from "./config";

function widgetSource(attributes: Record<string, string> = {}): Element {
  return {
    getAttribute: (name: string) => attributes[name] ?? null,
    ownerDocument: { documentElement: { lang: "en" } },
  } as unknown as Element;
}

describe("parseWidgetConfig fullscreen options", () => {
  it("keeps fullscreen optional by default", () => {
    expect(parseWidgetConfig(widgetSource())).toMatchObject({ mode: "demo" });
    expect(parseWidgetConfig(widgetSource())).not.toHaveProperty("fullscreen");
    expect(parseWidgetConfig(widgetSource())).not.toHaveProperty("fullscreenOnOpen");
    expect(parseWidgetConfig(widgetSource())).not.toHaveProperty("fullscreenOnLoad");
  });

  it("enables the fullscreen control and supports fullscreen on load", () => {
    expect(
      parseWidgetConfig(
        widgetSource({
          "data-contextrocket-fullscreen": "true",
          "data-contextrocket-fullscreen-on-open": "true",
          "data-contextrocket-fullscreen-on-load": "1",
        }),
      ),
    ).toMatchObject({ fullscreen: true, fullscreenOnOpen: true, fullscreenOnLoad: true });
  });

  it("does not treat arbitrary values as enabled", () => {
    expect(
      parseWidgetConfig(
        widgetSource({
          "data-contextrocket-fullscreen": "yes; display: none",
          "data-contextrocket-fullscreen-on-load": "false",
        }),
      ),
    ).not.toHaveProperty("fullscreen");
  });
});

describe("parseWidgetConfig brand palette", () => {
  it("accepts bounded site colors without a light/dark appearance mode", () => {
    const config = parseWidgetConfig(widgetSource({
      "data-contextrocket-background": "#faf9f6",
      "data-contextrocket-foreground": "#0e0f13",
      "data-contextrocket-surface": "#ffffff",
      "data-contextrocket-muted": "#5e616b",
      "data-contextrocket-border": "#e3e0d9",
      "data-contextrocket-accent": "#0e0f13",
    }));

    expect(config).toMatchObject({
      backgroundColor: "#faf9f6",
      foregroundColor: "#0e0f13",
      surfaceColor: "#ffffff",
      mutedColor: "#5e616b",
      borderColor: "#e3e0d9",
      accentColor: "#0e0f13",
    });
    expect(config).not.toHaveProperty("theme");
  });
});
