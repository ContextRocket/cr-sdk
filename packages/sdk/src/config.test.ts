import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveCRConfig } from "./config.js";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("resolveCRConfig", () => {
  it("reads statically exposed Next public variables", () => {
    vi.stubEnv("NEXT_PUBLIC_CONTEXTROCKET_HANDLE", "next-org");
    vi.stubEnv("NEXT_PUBLIC_CONTEXTROCKET_API_KEY", "publishable-key");

    expect(resolveCRConfig()).toMatchObject({
      handle: "next-org",
      apiKey: "publishable-key",
    });
  });

  it("lets Astro pass import.meta.env values explicitly", () => {
    vi.stubEnv("NEXT_PUBLIC_CONTEXTROCKET_HANDLE", "fallback-org");
    vi.stubEnv("NEXT_PUBLIC_CONTEXTROCKET_API_KEY", "fallback-key");

    expect(resolveCRConfig({
      agentUrl: "https://api.example.test/",
      handle: "astro-org",
      apiKey: "astro-key",
    })).toMatchObject({
      agentUrl: "https://api.example.test",
      handle: "astro-org",
      apiKey: "astro-key",
    });
  });
});
