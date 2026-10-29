import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  A2AParseError,
  buildTextTurnParams,
  parseA2AEvent,
  resetGuestSessionIdWarning,
  sendTask,
  streamTask,
  type A2AEvent,
} from "./a2a-client.js";

/**
 * Wire contract under test: the current A2A 1.0 contract from the CR backend.
 * Golden frames are ported from
 *   backend/tests/modules/agent/agent/a2a/test_endpoint.py
 * and the projection in
 *   backend/app/modules/agent/a2a/current_contract.py
 * (statusUpdate / artifactUpdate envelopes, TASK_STATE_* states, typeless
 * one-of parts, {task} sync result, A2A-Version header).
 */

// ── Golden frames (ported from the CR backend endpoint tests) ────────────────

const SUBMITTED_FRAME = {
  jsonrpc: "2.0",
  id: "test-1",
  result: {
    statusUpdate: {
      taskId: "task-1",
      contextId: "thread-1",
      status: {
        state: "TASK_STATE_SUBMITTED",
        timestamp: "2026-01-01T00:00:00Z",
      },
      metadata: { thread_id: "thread-1" },
    },
  },
};

const WORKING_FRAME = {
  jsonrpc: "2.0",
  id: "test-1",
  result: {
    statusUpdate: {
      taskId: "task-1",
      contextId: "thread-1",
      status: {
        state: "TASK_STATE_WORKING",
        timestamp: "2026-01-01T00:00:01Z",
      },
      metadata: { thread_id: "thread-1" },
    },
  },
};

const ARTIFACT_FRAME = {
  jsonrpc: "2.0",
  id: "test-1",
  result: {
    artifactUpdate: {
      taskId: "task-1",
      contextId: "thread-1",
      append: false,
      lastChunk: false,
      artifact: {
        artifactId: "task-1:artifact:0",
        parts: [{ text: "alpha beta gamma" }],
        metadata: { index: 0 },
      },
      metadata: { thread_id: "thread-1" },
    },
  },
};

const FINAL_ARTIFACT_FRAME = {
  jsonrpc: "2.0",
  id: "test-1",
  result: {
    artifactUpdate: {
      taskId: "task-1",
      contextId: "thread-1",
      append: true,
      lastChunk: true,
      artifact: {
        artifactId: "task-1:artifact:0",
        parts: [{ text: " delta epsilon" }],
        metadata: { index: 0 },
      },
      metadata: { thread_id: "thread-1" },
    },
  },
};

const COMPLETED_FRAME = {
  jsonrpc: "2.0",
  id: "test-1",
  result: {
    statusUpdate: {
      taskId: "task-1",
      contextId: "thread-1",
      status: {
        state: "TASK_STATE_COMPLETED",
        timestamp: "2026-01-01T00:00:02Z",
        message: {
          role: "ROLE_AGENT",
          parts: [{ text: "alpha beta gamma delta epsilon" }],
          messageId: "task-1:message:0",
          contextId: "thread-1",
        },
      },
      metadata: { thread_id: "thread-1", customerSafe: true },
    },
  },
};

const INPUT_REQUIRED_FRAME = {
  jsonrpc: "2.0",
  id: "test-1",
  result: {
    statusUpdate: {
      taskId: "task-1",
      contextId: "thread-1",
      status: { state: "TASK_STATE_INPUT_REQUIRED" },
      metadata: { thread_id: "thread-1" },
    },
  },
};

const FAILED_FRAME = {
  jsonrpc: "2.0",
  id: "test-1",
  result: {
    statusUpdate: {
      taskId: "task-1",
      contextId: "thread-1",
      status: { state: "TASK_STATE_FAILED" },
      metadata: { error_key: "ERROR_A2A_INTERNAL" },
    },
  },
};

const SYNC_TASK_RESULT = {
  jsonrpc: "2.0",
  id: "test-1",
  result: {
    task: {
      id: "task-1",
      contextId: "thread-1",
      status: {
        state: "TASK_STATE_COMPLETED",
        timestamp: "2026-01-01T00:00:02Z",
      },
      artifacts: [],
      history: [],
    },
  },
};

const dataLine = (frame: unknown) => `data: ${JSON.stringify(frame)}`;

function sseResponse(frames: unknown[]): Response {
  const body = frames.map((f) => `${dataLine(f)}\n\n`).join("");
  return new Response(
    new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(body));
        controller.close();
      },
    }),
    { status: 200, headers: { "content-type": "text/event-stream" } },
  );
}

// ── parseA2AEvent: current-wire envelopes ─────────────────────────────────────

describe("parseA2AEvent (current wire)", () => {
  it("maps a TASK_STATE_SUBMITTED statusUpdate to a submitted event", () => {
    const event = parseA2AEvent(dataLine(SUBMITTED_FRAME));
    expect(event).toEqual({
      type: "TaskStatusUpdateEvent",
      id: "task-1",
      status: { state: "submitted", timestamp: "2026-01-01T00:00:00Z" },
      final: false,
      metadata: { thread_id: "thread-1" },
    });
  });

  it("maps a TASK_STATE_WORKING statusUpdate to a working event", () => {
    const event = parseA2AEvent(dataLine(WORKING_FRAME));
    expect(event?.type).toBe("TaskStatusUpdateEvent");
    expect(event && "status" in event && event.status.state).toBe("working");
  });

  it("maps an artifactUpdate with typeless parts to an artifact event", () => {
    const event = parseA2AEvent(dataLine(ARTIFACT_FRAME)) as Extract<
      A2AEvent,
      { type: "TaskArtifactUpdateEvent" }
    >;
    expect(event.type).toBe("TaskArtifactUpdateEvent");
    expect(event.id).toBe("task-1");
    expect(event.artifact.parts).toEqual([
      { type: "text", text: "alpha beta gamma" },
    ]);
    expect(event.artifact.append).toBe(false);
    expect(event.artifact.lastChunk).toBe(false);
    expect(event.artifact.index).toBe(0);
    expect(event.final).toBe(false);
  });

  it("reads append/lastChunk from the update, not the artifact", () => {
    const event = parseA2AEvent(dataLine(FINAL_ARTIFACT_FRAME)) as Extract<
      A2AEvent,
      { type: "TaskArtifactUpdateEvent" }
    >;
    expect(event.artifact.append).toBe(true);
    expect(event.artifact.lastChunk).toBe(true);
    expect(event.artifact.parts).toEqual([
      { type: "text", text: " delta epsilon" },
    ]);
  });

  it("maps a TASK_STATE_COMPLETED statusUpdate to a final completed event", () => {
    const event = parseA2AEvent(dataLine(COMPLETED_FRAME)) as Extract<
      A2AEvent,
      { type: "TaskStatusUpdateEvent" }
    >;
    expect(event.status.state).toBe("completed");
    expect(event.final).toBe(true);
    expect(event.status.message).toEqual({
      role: "agent",
      parts: [{ type: "text", text: "alpha beta gamma delta epsilon" }],
    });
    expect(event.metadata?.customerSafe).toBe(true);
  });

  it("maps TASK_STATE_INPUT_REQUIRED to input-required and marks it final", () => {
    const event = parseA2AEvent(dataLine(INPUT_REQUIRED_FRAME));
    expect(event && "status" in event && event.status.state).toBe(
      "input-required",
    );
    expect(event?.final).toBe(true);
  });

  it("maps TASK_STATE_FAILED to failed and marks it final", () => {
    const event = parseA2AEvent(dataLine(FAILED_FRAME)) as Extract<
      A2AEvent,
      { type: "TaskStatusUpdateEvent" }
    >;
    expect(event.status.state).toBe("failed");
    expect(event.final).toBe(true);
    expect(event.metadata?.error_key).toBe("ERROR_A2A_INTERNAL");
  });

  it("returns null for unknown TASK_STATE values", () => {
    const frame = {
      jsonrpc: "2.0",
      id: "test-1",
      result: {
        statusUpdate: {
          taskId: "task-1",
          status: { state: "TASK_STATE_REJECTED" },
        },
      },
    };
    expect(parseA2AEvent(dataLine(frame))).toBeNull();
  });

  it("surfaces a JSON-RPC error envelope as a final failed event", () => {
    const frame = {
      jsonrpc: "2.0",
      id: "test-1",
      error: { code: -32601, message: "Method not found" },
    };
    const event = parseA2AEvent(dataLine(frame)) as Extract<
      A2AEvent,
      { type: "TaskStatusUpdateEvent" }
    >;
    expect(event.status.state).toBe("failed");
    expect(event.final).toBe(true);
    expect(event.metadata?.reason).toBe("Method not found");
  });
});

// ── parseA2AEvent: legacy tolerance ───────────────────────────────────────────

describe("parseA2AEvent (legacy tolerance)", () => {
  it("passes through a legacy result.type status event", () => {
    const frame = {
      jsonrpc: "2.0",
      id: "test-1",
      result: {
        type: "TaskStatusUpdateEvent",
        id: "task-1",
        status: { state: "working", timestamp: "2026-01-01T00:00:01Z" },
        final: false,
        metadata: { thread_id: "thread-1" },
      },
    };
    const event = parseA2AEvent(dataLine(frame));
    expect(event?.type).toBe("TaskStatusUpdateEvent");
    expect(event && "status" in event && event.status.state).toBe("working");
  });

  it("passes through a legacy result.type artifact event", () => {
    const frame = {
      jsonrpc: "2.0",
      id: "test-1",
      result: {
        type: "TaskArtifactUpdateEvent",
        id: "task-1",
        artifact: {
          parts: [{ type: "text", text: "hello" }],
          index: 0,
          append: false,
          lastChunk: true,
        },
        final: true,
        metadata: {},
      },
    };
    const event = parseA2AEvent(dataLine(frame)) as Extract<
      A2AEvent,
      { type: "TaskArtifactUpdateEvent" }
    >;
    expect(event.type).toBe("TaskArtifactUpdateEvent");
    expect(event.artifact.parts[0]?.text).toBe("hello");
  });
});

// ── parseA2AEvent: non-event lines ────────────────────────────────────────────

describe("parseA2AEvent (line hygiene)", () => {
  it("returns null for non-data lines, empty data, and [DONE]", () => {
    expect(parseA2AEvent(": comment")).toBeNull();
    expect(parseA2AEvent("event: message")).toBeNull();
    expect(parseA2AEvent("data:")).toBeNull();
    expect(parseA2AEvent("data: [DONE]")).toBeNull();
  });

  it("throws A2AParseError on malformed JSON", () => {
    expect(() => parseA2AEvent("data: {nope")).toThrow(A2AParseError);
  });

  it("returns null for unknown result shapes", () => {
    expect(
      parseA2AEvent(
        "data: " +
          JSON.stringify({ jsonrpc: "2.0", id: "1", result: { foo: 1 } }),
      ),
    ).toBeNull();
  });
});

// ── buildTextTurnParams: current wire request shape ───────────────────────────

describe("buildTextTurnParams", () => {
  it("builds a ROLE_USER message with typeless text parts", () => {
    const params = buildTextTurnParams("hello");
    expect(params.message.role).toBe("ROLE_USER");
    expect(params.message.parts).toEqual([{ text: "hello" }]);
    expect("type" in params.message.parts[0]!).toBe(false);
  });

  it("carries threadId as contextId and metadata.thread_id", () => {
    const params = buildTextTurnParams("hello", { threadId: "thread-1" });
    expect(params.message.contextId).toBe("thread-1");
    expect(params.metadata?.thread_id).toBe("thread-1");
  });

  it("carries handle in metadata for anonymous browser turns", () => {
    const params = buildTextTurnParams("hello", { handle: "acme" });
    expect(params.metadata?.handle).toBe("acme");
  });

  it("ignores guestSessionId, drops it from metadata, and warns once", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    resetGuestSessionIdWarning();
    const params = buildTextTurnParams("hello", {
      guestSessionId: "guest-1",
      handle: "acme",
    });
    expect(params.metadata?.guest_session_id).toBeUndefined();
    expect(params.metadata?.handle).toBe("acme");
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]?.[0])).toContain("guestSessionId");
    // Second call does not repeat the warning.
    buildTextTurnParams("again", { guestSessionId: "guest-1" });
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });
});

// ── sendTask: method, header, {task} unwrap ───────────────────────────────────

describe("sendTask", () => {
  const captured: { url?: string; init?: RequestInit } = {};

  beforeEach(() => {
    captured.url = undefined;
    captured.init = undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        captured.url = url;
        captured.init = init;
        return new Response(JSON.stringify(SYNC_TASK_RESULT), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    resetGuestSessionIdWarning();
  });

  it("POSTs SendMessage with the A2A-Version header and current wire params", async () => {
    const params = buildTextTurnParams("hi", { handle: "acme" });
    await sendTask(
      { baseUrl: "https://api.example.com", apiKey: "key-1" },
      params,
    );

    expect(captured.url).toBe("https://api.example.com/api/agent/a2a");
    const headers = new Headers(captured.init?.headers);
    expect(headers.get("A2A-Version")).toBe("1.0");
    expect(headers.get("X-Api-Key")).toBe("key-1");

    const body = JSON.parse(String(captured.init?.body));
    expect(body.method).toBe("SendMessage");
    expect(body.params.message.role).toBe("ROLE_USER");
    expect(body.params.message.parts).toEqual([{ text: "hi" }]);
    expect(body.params.metadata.handle).toBe("acme");
  });

  it("unwraps the {task} sync result", async () => {
    const task = await sendTask(
      { baseUrl: "https://api.example.com" },
      buildTextTurnParams("hi"),
    );
    expect(task.id).toBe("task-1");
    expect(task.contextId).toBe("thread-1");
    expect((task.status as { state: string }).state).toBe(
      "TASK_STATE_COMPLETED",
    );
  });

  it("throws on JSON-RPC error envelopes", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              jsonrpc: "2.0",
              id: "1",
              error: { code: -32601, message: "Method not found" },
            }),
            { status: 200 },
          ),
      ),
    );
    await expect(
      sendTask(
        { baseUrl: "https://api.example.com" },
        buildTextTurnParams("hi"),
      ),
    ).rejects.toThrow("Method not found");
  });

  it("warns (once) and ignores a provided guestSessionId", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    resetGuestSessionIdWarning();
    await sendTask(
      { baseUrl: "https://api.example.com", guestSessionId: "guest-1" },
      buildTextTurnParams("hi"),
    );
    expect(warn).toHaveBeenCalledTimes(1);
    const headers = new Headers(captured.init?.headers);
    expect(headers.get("authorization")).toBeNull();
    warn.mockRestore();
  });
});

// ── streamTask: method, header, normalized events ─────────────────────────────

describe("streamTask", () => {
  const captured: { init?: RequestInit } = {};

  beforeEach(() => {
    captured.init = undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        captured.init = init;
        return sseResponse([
          SUBMITTED_FRAME,
          WORKING_FRAME,
          ARTIFACT_FRAME,
          FINAL_ARTIFACT_FRAME,
          COMPLETED_FRAME,
        ]);
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("POSTs SendStreamingMessage with the A2A-Version header", async () => {
    for await (const _ of streamTask(
      { baseUrl: "https://api.example.com" },
      buildTextTurnParams("go"),
    )) {
      // drain
    }
    const headers = new Headers(captured.init?.headers);
    expect(headers.get("A2A-Version")).toBe("1.0");
    expect(headers.get("Accept")).toBe("text/event-stream");
    const body = JSON.parse(String(captured.init?.body));
    expect(body.method).toBe("SendStreamingMessage");
    expect(body.params.message.role).toBe("ROLE_USER");
    expect(body.params.message.parts).toEqual([{ text: "go" }]);
  });

  it("yields normalized events in order and stops at the terminal event", async () => {
    const events: A2AEvent[] = [];
    for await (const event of streamTask(
      { baseUrl: "https://api.example.com" },
      buildTextTurnParams("go"),
    )) {
      events.push(event);
    }
    expect(events.map((e) => e.type)).toEqual([
      "TaskStatusUpdateEvent",
      "TaskStatusUpdateEvent",
      "TaskArtifactUpdateEvent",
      "TaskArtifactUpdateEvent",
      "TaskStatusUpdateEvent",
    ]);
    const states = events.map((e) =>
      e.type === "TaskStatusUpdateEvent" ? e.status.state : null,
    );
    expect(states).toEqual(["submitted", "working", null, null, "completed"]);
    expect(events.at(-1)?.final).toBe(true);
    // Text is read from typeless wire parts.
    const text = events
      .filter((e) => e.type === "TaskArtifactUpdateEvent")
      .map((e) =>
        e.type === "TaskArtifactUpdateEvent"
          ? e.artifact.parts.map((p) => p.text).join("")
          : "",
      )
      .join("");
    expect(text).toBe("alpha beta gamma delta epsilon");
  });
});

it("preserves logical message identity across wire retries and separates identical new turns", async () => {
  const sent: { id: string; params: { message: { messageId?: string } } }[] =
    [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, init?: RequestInit) => {
      sent.push(JSON.parse(String(init?.body)));
      if (new Headers(init?.headers).get("Accept") === "text/event-stream")
        return sseResponse([COMPLETED_FRAME]);
      return new Response(JSON.stringify(SYNC_TASK_RESULT), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }),
  );
  try {
    const options = { baseUrl: "https://api.example.com" };
    const turn = buildTextTurnParams("same text", { handle: "acme" });
    await sendTask(options, turn);
    await sendTask(options, turn);
    await sendTask(
      options,
      buildTextTurnParams("same text", { handle: "acme" }),
    );
    expect(sent[0]?.params.message.messageId).toMatch(/^[0-9a-f-]{36}$/);
    expect(sent[1]?.params.message.messageId).toBe(
      sent[0]?.params.message.messageId,
    );
    expect(sent[1]?.id).not.toBe(sent[0]?.id);
    expect(sent[2]?.params.message.messageId).not.toBe(
      sent[0]?.params.message.messageId,
    );
    const retry = buildTextTurnParams("same text", {
      handle: "acme",
      messageId: turn.message.messageId,
    });
    for await (const _ of streamTask(options, retry)) {
      /* drain the actual wire */
    }
    for await (const _ of streamTask(options, retry)) {
      /* retry streaming */
    }
    expect(sent[3]?.params.message.messageId).toBe(
      sent[0]?.params.message.messageId,
    );
    expect(sent[4]?.params.message.messageId).toBe(
      sent[0]?.params.message.messageId,
    );
    expect(new Set(sent.map((request) => request.id)).size).toBe(5);
  } finally {
    vi.unstubAllGlobals();
  }
});
