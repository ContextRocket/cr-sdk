import { describe, expect, it } from "vitest";
import {
  collectEmbedA2aSubscribe,
  createInMemoryEmbedWidgetA2aPort,
  type EmbedWidgetA2aFetch,
} from "./a2a-transport";
import type { WidgetConfig, WidgetTransportEvent } from "./types";

/**
 * Wire contract under test: the current A2A 1.0 contract from the CR backend.
 * Golden frames are ported from
 *   backend/tests/modules/agent/agent/a2a/test_endpoint.py
 * and the projection in
 *   backend/app/modules/agent/a2a/current_contract.py
 * (SendStreamingMessage, ROLE_USER, typeless one-of parts, statusUpdate /
 * artifactUpdate envelopes, TASK_STATE_* states, A2A-Version header).
 */

const LIVE_CONFIG: WidgetConfig = {
  mode: "live",
  apiBaseUrl: "https://api.example.com",
  apiKey: "key-1",
  handle: "acme",
};

const SUBMITTED_FRAME = {
  jsonrpc: "2.0",
  id: "embed-1",
  result: {
    statusUpdate: {
      taskId: "task-1",
      contextId: "thread-1",
      status: { state: "TASK_STATE_SUBMITTED" },
      metadata: { thread_id: "thread-1" },
    },
  },
};

const WORKING_FRAME = {
  jsonrpc: "2.0",
  id: "embed-1",
  result: {
    statusUpdate: {
      taskId: "task-1",
      contextId: "thread-1",
      status: { state: "TASK_STATE_WORKING" },
      metadata: { thread_id: "thread-1" },
    },
  },
};

const ARTIFACT_FRAME = {
  jsonrpc: "2.0",
  id: "embed-1",
  result: {
    artifactUpdate: {
      taskId: "task-1",
      contextId: "thread-1",
      append: false,
      lastChunk: false,
      artifact: {
        artifactId: "task-1:artifact:0",
        parts: [{ text: "Hello, " }],
        metadata: { index: 0 },
      },
      metadata: { thread_id: "thread-1" },
    },
  },
};

const FINAL_ARTIFACT_FRAME = {
  jsonrpc: "2.0",
  id: "embed-1",
  result: {
    artifactUpdate: {
      taskId: "task-1",
      contextId: "thread-1",
      append: true,
      lastChunk: true,
      artifact: {
        artifactId: "task-1:artifact:0",
        parts: [{ text: "world!" }],
        metadata: { index: 0 },
      },
      metadata: { thread_id: "thread-1" },
    },
  },
};

const COMPLETED_FRAME = {
  jsonrpc: "2.0",
  id: "embed-1",
  result: {
    statusUpdate: {
      taskId: "task-1",
      contextId: "thread-1",
      status: {
        state: "TASK_STATE_COMPLETED",
        message: {
          role: "ROLE_AGENT",
          parts: [{ text: "Hello, world!" }],
        },
      },
      metadata: { thread_id: "thread-1" },
    },
  },
};

const FAILED_FRAME = {
  jsonrpc: "2.0",
  id: "embed-1",
  result: {
    statusUpdate: {
      taskId: "task-1",
      contextId: "thread-1",
      status: { state: "TASK_STATE_FAILED" },
      metadata: {},
    },
  },
};

const INPUT_REQUIRED_FRAME = {
  jsonrpc: "2.0",
  id: "embed-1",
  result: {
    statusUpdate: {
      taskId: "task-1",
      contextId: "thread-1",
      status: { state: "TASK_STATE_INPUT_REQUIRED" },
      metadata: { thread_id: "thread-1" },
    },
  },
};

function sseBody(frames: unknown[]): string {
  return frames.map((f) => `data: ${JSON.stringify(f)}\n\n`).join("");
}

function livePortWithFrames(frames: unknown[]) {
  const body = sseBody(frames);
  return createInMemoryEmbedWidgetA2aPort(async () =>
    new Response(body, {
      status: 200,
      headers: { "content-type": "text/event-stream" },
    }),
  );
}

function capturePort(): {
  port: ReturnType<typeof createInMemoryEmbedWidgetA2aPort>;
  captured: { url?: string; init?: RequestInit };
} {
  const captured: { url?: string; init?: RequestInit } = {};
  const handler: EmbedWidgetA2aFetch = async (url, init) => {
    captured.url = String(url);
    captured.init = init;
    return new Response(sseBody([WORKING_FRAME, COMPLETED_FRAME]), {
      status: 200,
      headers: { "content-type": "text/event-stream" },
    });
  };
  return { port: createInMemoryEmbedWidgetA2aPort(handler), captured };
}

describe("streamEmbedA2aSubscribe (request)", () => {
  it("POSTs SendStreamingMessage with ROLE_USER, typeless parts, and A2A-Version", async () => {
    const { port, captured } = capturePort();
    await collectEmbedA2aSubscribe(LIVE_CONFIG, { message: "hi" }, port);
    expect(captured.url).toBe("https://api.example.com/api/agent/a2a");
    const headers = new Headers(captured.init?.headers);
    expect(headers.get("a2a-version")).toBe("1.0");
    expect(headers.get("content-type")).toBe("application/json");
    expect(headers.get("accept")).toBe("text/event-stream");
    expect(headers.get("x-api-key")).toBe("key-1");

    const body = JSON.parse(String(captured.init?.body));
    expect(body.method).toBe("SendStreamingMessage");
    expect(body.params.message.role).toBe("ROLE_USER");
    expect(body.params.message.parts).toEqual([{ text: "hi" }]);
    expect(body.params.metadata.handle).toBe("acme");
  });

  it("carries a UUID threadId as message.contextId", async () => {
    const { port, captured } = capturePort();
    const threadId = "11111111-2222-3333-4444-555555555555";
    await collectEmbedA2aSubscribe(
      LIVE_CONFIG,
      { message: "hi", threadId },
      port,
    );
    const body = JSON.parse(String(captured.init?.body));
    expect(body.params.message.contextId).toBe(threadId);
  });
});

describe("streamEmbedA2aSubscribe (current-wire frames)", () => {
  it("maps submitted/working statusUpdates to non-terminal meta events", async () => {
    const port = livePortWithFrames([SUBMITTED_FRAME, WORKING_FRAME]);
    const events = await collectEmbedA2aSubscribe(
      LIVE_CONFIG,
      { message: "hi" },
      port,
    );
    const meta = events.filter((e) => e.type === "meta");
    expect(meta).toEqual([
      { type: "meta", state: "submitted", terminal: false },
      { type: "meta", state: "working", terminal: false },
    ]);
  });

  it("extracts text from typeless artifact parts and finishes on completed", async () => {
    const port = livePortWithFrames([
      ARTIFACT_FRAME,
      FINAL_ARTIFACT_FRAME,
      COMPLETED_FRAME,
    ]);
    const events = await collectEmbedA2aSubscribe(
      LIVE_CONFIG,
      { message: "hi" },
      port,
    );
    const text = events
      .filter((e): e is Extract<WidgetTransportEvent, { type: "delta" }> => e.type === "delta")
      .map((e) => e.text)
      .join("");
    expect(text).toBe("Hello, world!");
    expect(events.at(-1)).toEqual({
      type: "done",
      taskId: "task-1",
    });
  });

  it("maps TASK_STATE_FAILED to an error event", async () => {
    const port = livePortWithFrames([FAILED_FRAME]);
    const events = await collectEmbedA2aSubscribe(
      LIVE_CONFIG,
      { message: "hi" },
      port,
    );
    expect(events.at(-1)).toEqual({ type: "error", message: expect.any(String) });
  });

  it("maps TASK_STATE_INPUT_REQUIRED to a terminal done event", async () => {
    const port = livePortWithFrames([INPUT_REQUIRED_FRAME]);
    const events = await collectEmbedA2aSubscribe(
      LIVE_CONFIG,
      { message: "hi" },
      port,
    );
    const meta = events.find((e) => e.type === "meta");
    expect(meta).toMatchObject({ state: "input-required", terminal: true });
    expect(events.at(-1)).toEqual({ type: "done", taskId: "task-1" });
  });

  it("surfaces an honest interrupted error when the stream lacks a terminal event", async () => {
    const port = livePortWithFrames([WORKING_FRAME]);
    const events = await collectEmbedA2aSubscribe(
      LIVE_CONFIG,
      { message: "hi" },
      port,
    );
    expect(events.at(-1)?.type).toBe("error");
    expect(
      events.at(-1) &&
        "message" in events.at(-1)! &&
        events.at(-1)!.message,
    ).toContain("connection ended");
  });

  it("emits a session event when metadata carries a UUID thread_id", async () => {
    const uuid = "11111111-2222-3333-4444-555555555555";
    const withUuidThread = (frame: typeof WORKING_FRAME) =>
      JSON.parse(JSON.stringify(frame).replaceAll("thread-1", uuid));
    const port = livePortWithFrames([
      withUuidThread(WORKING_FRAME),
      withUuidThread(COMPLETED_FRAME),
    ]);
    const events = await collectEmbedA2aSubscribe(
      LIVE_CONFIG,
      { message: "hi" },
      port,
    );
    expect(events).toContainEqual({
      type: "session",
      threadId: uuid,
    });
  });
});

describe("streamEmbedA2aSubscribe (legacy tolerance)", () => {
  it("still maps legacy result.type frames", async () => {
    const legacyWorking = {
      jsonrpc: "2.0",
      id: "embed-1",
      result: {
        type: "TaskStatusUpdateEvent",
        id: "task-1",
        status: { state: "working" },
        final: false,
        metadata: { thread_id: "thread-1" },
      },
    };
    const legacyArtifact = {
      jsonrpc: "2.0",
      id: "embed-1",
      result: {
        type: "TaskArtifactUpdateEvent",
        id: "task-1",
        artifact: {
          parts: [{ type: "text", text: "legacy " }],
          index: 0,
          append: false,
          lastChunk: false,
        },
        final: false,
        metadata: {},
      },
    };
    const legacyCompleted = {
      jsonrpc: "2.0",
      id: "embed-1",
      result: {
        type: "TaskStatusUpdateEvent",
        id: "task-1",
        status: { state: "completed" },
        final: true,
        metadata: { thread_id: "thread-1" },
      },
    };
    const port = livePortWithFrames([
      legacyWorking,
      legacyArtifact,
      legacyCompleted,
    ]);
    const events = await collectEmbedA2aSubscribe(
      LIVE_CONFIG,
      { message: "hi" },
      port,
    );
    const text = events
      .filter((e): e is Extract<WidgetTransportEvent, { type: "delta" }> => e.type === "delta")
      .map((e) => e.text)
      .join("");
    expect(text).toBe("legacy ");
    expect(events.at(-1)).toEqual({ type: "done", taskId: "task-1" });
  });

  it("maps a JSON-RPC error envelope to an error event", async () => {
    const port = createInMemoryEmbedWidgetA2aPort(
      async () =>
        new Response(
          sseBody([
            {
              jsonrpc: "2.0",
              id: "embed-1",
              error: { code: -32601, message: "Method not found" },
            },
          ]),
          { status: 200, headers: { "content-type": "text/event-stream" } },
        ),
    );
    const events = await collectEmbedA2aSubscribe(
      LIVE_CONFIG,
      { message: "hi" },
      port,
    );
    expect(events).toEqual([{ type: "error", message: expect.any(String) }]);
  });
});

describe("streamEmbedA2aSubscribe (demo mode)", () => {
  it("streams the canned demo response without touching the network", async () => {
    const port = createInMemoryEmbedWidgetA2aPort(async () => {
      throw new Error("network must not be used in demo mode");
    });
    const events = await collectEmbedA2aSubscribe(
      { mode: "demo" },
      { message: "hi", threadId: "demo-thread" },
      port,
    );
    const text = events
      .filter((e): e is Extract<WidgetTransportEvent, { type: "delta" }> => e.type === "delta")
      .map((e) => e.text)
      .join("");
    expect(text).toContain("canned ContextRocket demo response");
    expect(events.at(-1)).toEqual({ type: "done", taskId: "demo-task" });
  });
});
