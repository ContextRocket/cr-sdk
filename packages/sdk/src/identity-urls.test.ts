import { describe, expect, it } from "vitest";
import {
  crGroundingPageUrl,
  crIdentityPath,
  crIdentityUrl,
} from "./identity-urls.js";

describe("ContextRocket typed identity URLs", () => {
  it("builds the public typed Grounding Page URL for company and person identities", () => {
    expect(crGroundingPageUrl("company", "acme"))
      .toBe("https://contextrocket.com/company/acme/facts");
    expect(crGroundingPageUrl("person", "mark"))
      .toBe("https://contextrocket.com/person/mark/facts");
  });

  it("preserves the typed path on a verified customer web origin", () => {
    expect(crGroundingPageUrl("company", "acme", "https://www.acme.example/"))
      .toBe("https://www.acme.example/company/acme/facts");
  });

  it("encodes a reserved-character handle as one Grounding Page path segment", () => {
    expect(crGroundingPageUrl("person", "mark/name?team=one#anchor"))
      .toBe("https://contextrocket.com/person/mark%2Fname%3Fteam%3Done%23anchor/facts");
  });

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
