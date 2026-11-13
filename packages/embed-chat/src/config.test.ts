import { describe, expect, it } from "vitest";
import {
  buildWidgetA2aUrl,
  buildWidgetAgentCardUrl,
  parseWidgetConfig,
} from "./config";

function widgetSource(attributes: Record<string, string> = {}): Element {
  return {
    getAttribute: (name: string) => attributes[name] ?? null,
    ownerDocument: { baseURI: "https://site.example/", documentElement: { lang: "en" } },
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

describe("parseWidgetConfig agent avatar", () => {
  it("defaults public widget surfaces to the ContextRocket identity", () => {
    expect(parseWidgetConfig(widgetSource())).toMatchObject({ agentIdentity: "contextrocket" });
  });

  it("allows the Probe identity on product surfaces", () => {
    expect(parseWidgetConfig(widgetSource({
      "data-contextrocket-agent-identity": "probe",
    }))).toMatchObject({ agentIdentity: "probe" });
  });

  it("accepts a site-relative portrait URL", () => {
    expect(parseWidgetConfig(widgetSource({
      "data-contextrocket-agent-avatar": "/luna/avatar.webp",
    }))).toMatchObject({ agentAvatarUrl: "/luna/avatar.webp" });
  });

  it("rejects non-web image URL schemes", () => {
    expect(parseWidgetConfig(widgetSource({
      "data-contextrocket-agent-avatar": "javascript:alert(1)",
    }))).not.toHaveProperty("agentAvatarUrl");
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

describe("parseWidgetConfig launcher color", () => {
  it("defaults to the Rocket Pink rounded-square palette", () => {
    expect(parseWidgetConfig(widgetSource())).toMatchObject({
      launcherColor: "#FF2B67",
      launcherForeground: "#FFFFFF",
    });
  });

  it("uses the Ink background and white rocket when requested", () => {
    expect(parseWidgetConfig(widgetSource({
      "data-contextrocket-launcher-color": "ink",
    }))).toMatchObject({
      launcherColor: "#0E0F13",
      launcherForeground: "#FFFFFF",
    });
  });

  it("selects a contrasting rocket color for a customer's color", () => {
    expect(parseWidgetConfig(widgetSource({
      "data-contextrocket-launcher-color": "#123456",
    }))).toMatchObject({
      launcherColor: "#123456",
      launcherForeground: "#FFFFFF",
    });
    expect(parseWidgetConfig(widgetSource({
      "data-contextrocket-launcher-color": "#FAF9F6",
    }))).toMatchObject({
      launcherColor: "#FAF9F6",
      launcherForeground: "#0E0F13",
    });
  });

  it("switches the rocket color at the white 3:1 contrast boundary", () => {
    expect(parseWidgetConfig(widgetSource({
      "data-contextrocket-launcher-color": "#949494",
    }))).toMatchObject({
      launcherColor: "#949494",
      launcherForeground: "#FFFFFF",
    });
    expect(parseWidgetConfig(widgetSource({
      "data-contextrocket-launcher-color": "#959595",
    }))).toMatchObject({
      launcherColor: "#959595",
      launcherForeground: "#0E0F13",
    });
  });

  it("falls back to Ink for an invalid custom color", () => {
    expect(parseWidgetConfig(widgetSource({
      "data-contextrocket-launcher-color": "url(javascript:alert(1))",
    }))).toMatchObject({
      launcherColor: "#0E0F13",
      launcherForeground: "#FFFFFF",
    });
  });
});

describe("typed identity URL builders", () => {
  it("routes tenant turns and cards through the selected typed identity", () => {
    const config = parseWidgetConfig(
      widgetSource({
        "data-contextrocket-mode": "live",
        "data-contextrocket-api-base": "https://api.example.com/",
        "data-contextrocket-handle": "mark-macmahon",
        "data-contextrocket-subject-kind": "person",
      }),
    )!;

    expect(config.subjectKind).toBe("person");
    expect(buildWidgetA2aUrl(config)).toBe(
      "https://api.example.com/person/mark-macmahon/a2a",
    );
    expect(
      buildWidgetAgentCardUrl(
        config.apiBaseUrl!,
        config.subjectKind!,
        config.handle!,
      ),
    ).toBe(
      "https://api.example.com/person/mark-macmahon/agent-card.json",
    );
  });

  it("uses the platform A2A endpoint only when no tenant handle is configured", () => {
    const config = parseWidgetConfig(
      widgetSource({
        "data-contextrocket-mode": "live",
        "data-contextrocket-api-base": "https://api.example.com",
      }),
    )!;

    expect(buildWidgetA2aUrl(config)).toBe("https://api.example.com/a2a");
  });
});
