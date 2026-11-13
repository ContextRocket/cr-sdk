import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveCRConfig } from "./config.js";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("resolveCRConfig", () => {
  it("does not silently target ContextRocket when no organization is configured", () => {
    expect(resolveCRConfig().handle).toBeUndefined();
  });

  it("lets callers explicitly select the handle-free platform endpoint", () => {
    vi.stubEnv("NEXT_PUBLIC_CONTEXTROCKET_HANDLE", "customer-org");

    expect(resolveCRConfig({ handle: undefined }).handle).toBeUndefined();
  });

  it("reads statically exposed Next public variables", () => {
    vi.stubEnv("NEXT_PUBLIC_CONTEXTROCKET_HANDLE", "next-org");
    vi.stubEnv("NEXT_PUBLIC_CONTEXTROCKET_SUBJECT_KIND", "person");
    vi.stubEnv("NEXT_PUBLIC_CONTEXTROCKET_API_KEY", "publishable-key");

    expect(resolveCRConfig()).toMatchObject({
      handle: "next-org",
      subjectKind: "person",
      apiKey: "publishable-key",
    });
  });

  it("lets Astro pass import.meta.env values explicitly", () => {
    vi.stubEnv("NEXT_PUBLIC_CONTEXTROCKET_HANDLE", "fallback-org");
    vi.stubEnv("NEXT_PUBLIC_CONTEXTROCKET_API_KEY", "fallback-key");

    expect(resolveCRConfig({
      agentUrl: "https://api.example.test/",
      handle: "astro-org",
      subjectKind: "person",
      apiKey: "astro-key",
    })).toMatchObject({
      agentUrl: "https://api.example.test",
      handle: "astro-org",
      subjectKind: "person",
      apiKey: "astro-key",
    });
  });
});
