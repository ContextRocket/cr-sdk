import { describe, expect, it } from "vitest";
import { parseAgentResponsePart } from "./json-render.js";

const responsePart = (props: Record<string, unknown> = { stage: "Searching", completed: 1, total: 2 }) => ({
  data: {
    component: "agent_ui",
    spec: {
      root: "response",
      elements: {
        response: { type: "Response", props: {}, children: ["progress"] },
        progress: { type: "Progress", props, children: [] },
      },
    },
  },
  metadata: {
    "cr.catalog": "contextrocket.agent.response.v2",
    "cr.component": "agent_ui",
  },
});

describe("parseAgentResponsePart", () => {
  it("accepts a valid closed v2 response catalog", () => {
    expect(parseAgentResponsePart(responsePart())).toMatchObject({
      root: "response",
      elements: { progress: { type: "Progress" } },
    });
  });

  it("ignores data parts from other catalogs", () => {
    const part = responsePart();
    part.metadata["cr.catalog"] = "other.catalog";
    expect(parseAgentResponsePart(part)).toBeUndefined();
  });

  it("accepts the current A2A 1.0 data one-of shape and rejects internal kind parts", () => {
    const part = responsePart();
    expect(parseAgentResponsePart(part)).toBeDefined();
    expect(parseAgentResponsePart({ ...part, kind: "data" })).toBeUndefined();
    expect(parseAgentResponsePart({ ...part, text: "not a data one-of" })).toBeUndefined();
  });

  it("fails closed when props contain unknown keys or component types", () => {
    expect(parseAgentResponsePart(responsePart({ stage: "Searching", completed: 1, total: 2, html: "<script>" }))).toBeNull();
    const part = responsePart();
    part.data.spec.elements.progress.type = "RawHtml";
    expect(parseAgentResponsePart(part)).toBeNull();
  });

  it("fails closed for malformed or oversized data", () => {
    expect(parseAgentResponsePart({ ...responsePart(), data: { component: "agent_ui", spec: null } })).toBeNull();
    const part = responsePart({ stage: "x".repeat(65_000), completed: 1, total: 2 });
    expect(parseAgentResponsePart(part)).toBeNull();
  });
});
