import { describe, expect, it } from "vitest";
import { crIdentityPath, crIdentityUrl } from "./identity-urls.js";

describe("ContextRocket typed identity URLs", () => {
  it("uses the explicitly selected company or person kind", () => {
    expect(crIdentityUrl("https://api.contextrocket.com", "company", "acme", "mcp"))
      .toBe("https://api.contextrocket.com/company/acme/mcp");
    expect(crIdentityUrl("https://api.contextrocket.com", "person", "mark", "a2a"))
      .toBe("https://api.contextrocket.com/person/mark/a2a");
  });

  it("encodes a reserved-character handle as one path segment", () => {
    expect(crIdentityPath("person", "mark/name?team=one#anchor", "agent-card.json"))
      .toBe("/person/mark%2Fname%3Fteam%3Done%23anchor/agent-card.json");
  });

  it("removes all trailing slashes from the API root", () => {
    expect(crIdentityUrl("https://api.contextrocket.com///", "company", "acme", "a2a"))
      .toBe("https://api.contextrocket.com/company/acme/a2a");
  });

  it("rejects an empty handle", () => {
    expect(() => crIdentityUrl("https://api.contextrocket.com", "company", "  ", "mcp"))
      .toThrow("A ContextRocket handle is required.");
  });
});
