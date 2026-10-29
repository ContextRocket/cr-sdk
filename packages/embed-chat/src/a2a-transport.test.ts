import { chromium } from "playwright";
import { buildSync } from "esbuild";
import { fileURLToPath } from "node:url";
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
  return createInMemoryEmbedWidgetA2aPort(
    async () =>
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
      .filter(
        (e): e is Extract<WidgetTransportEvent, { type: "delta" }> =>
          e.type === "delta",
      )
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
    expect(events.at(-1)).toMatchObject({
      type: "error",
      reason: "generic",
      message: expect.any(String),
    });
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
      events.at(-1) && "message" in events.at(-1)! && events.at(-1)!.message,
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
      .filter(
        (e): e is Extract<WidgetTransportEvent, { type: "delta" }> =>
          e.type === "delta",
      )
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
    expect(events).toEqual([
      { type: "error", reason: "generic", message: expect.any(String) },
    ]);
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
      .filter(
        (e): e is Extract<WidgetTransportEvent, { type: "delta" }> =>
          e.type === "delta",
      )
      .map((e) => e.text)
      .join("");
    expect(text).toContain("canned ContextRocket demo response");
    expect(events.at(-1)).toEqual({ type: "done", taskId: "demo-task" });
  });
});

it("delivers streamed content through the real native browser fetch port", async () => {
  const bundle = buildSync({
    entryPoints: [
      fileURLToPath(new URL("./a2a-transport.ts", import.meta.url)),
    ],
    bundle: true,
    write: false,
    format: "iife",
    globalName: "NativeWidgetTransport",
    platform: "browser",
    target: "es2020",
  }).outputFiles[0]!.text;
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const unexpected: string[] = [];
  let guardedRequests = 0;
  try {
    await page.route("**/*", async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      if (
        url.origin === "http://localhost:39991" &&
        url.pathname === "/" &&
        request.method() === "GET"
      ) {
        await route.fulfill({
          contentType: "text/html",
          body: `<script>${bundle}</script>`,
        });
      } else if (
        url.origin === "http://localhost:39991" &&
        url.pathname === "/api/agent/a2a" &&
        request.method() === "POST"
      ) {
        guardedRequests += 1;
        await route.fulfill({
          contentType: "text/event-stream",
          body: sseBody([WORKING_FRAME, ARTIFACT_FRAME, COMPLETED_FRAME]),
        });
      } else {
        unexpected.push(`${request.method()} ${url.pathname}`);
        await route.abort();
      }
    });
    await page.goto("http://localhost:39991");
    const events = await page.evaluate<
      WidgetTransportEvent[]
    >(`NativeWidgetTransport.collectEmbedA2aSubscribe(
      ${JSON.stringify({ ...LIVE_CONFIG, apiBaseUrl: "http://localhost:39991" })},
      {message:"Synthetic native transport test"}
    )`);
    expect(unexpected).toEqual([]);
    expect(guardedRequests).toBeGreaterThan(0);
    expect(
      events.some(
        (event) => event.type === "delta" && event.text.includes("Hello"),
      ),
    ).toBe(true);
    expect(events.some((event) => event.type === "done")).toBe(true);
    expect(events.some((event) => event.type === "error")).toBe(false);
  } finally {
    await browser.close();
  }
}, 15000);

it("keeps host-resolved recovery UI localized without changing caller or partial answer text", async () => {
  const bundle = buildSync({
    entryPoints: [fileURLToPath(new URL("./index.ts", import.meta.url))],
    bundle: true,
    write: false,
    format: "iife",
    globalName: "ContextRocketWidget",
    platform: "browser",
    target: "es2020",
  }).outputFiles[0]!.text;
  const browser = await chromium.launch();
  try {
    for (const item of [
      {
        host: "es-ES",
        locale: "auto",
        lang: "es",
        title: "Pregunta a ContextRocket",
        error: "Algo salió mal. Inténtalo de nuevo.",
      },
      {
        host: "de-AT",
        locale: undefined,
        lang: "de",
        title: "Frag ContextRocket",
        error: "Etwas ist schiefgelaufen. Versuch es erneut.",
      },
      {
        host: "es-MX",
        locale: "de",
        lang: "de",
        title: "Caller title",
        error: "Etwas ist schiefgelaufen. Versuch es erneut.",
        custom: true,
      },
      {
        host: "de-DE",
        locale: "es",
        lang: "es",
        title: "Pregunta a ContextRocket",
        error: "Algo salió mal. Inténtalo de nuevo.",
      },
      {
        host: "fr-FR",
        locale: undefined,
        lang: "en",
        title: "Ask ContextRocket",
        error: "Something went wrong. Try again.",
      },
    ]) {
      const page = await browser.newPage();
      page.setDefaultTimeout(5000);
      let attempts = 0;
      const sent: {
        id: string;
        params: { message: { messageId?: string } };
      }[] = [];
      const unexpected: string[] = [];
      await page.route("**/*", async (route) => {
        const url = new URL(route.request().url());
        if (url.origin === "http://localhost:39992" && url.pathname === "/") {
          await route.fulfill({
            contentType: "text/html",
            body: `<html lang="${item.host}"><script>${bundle}</script><contextrocket-chat data-contextrocket-mode="live" data-contextrocket-api-base="http://localhost:39992" data-contextrocket-greeting="Caller greeting" ${item.locale ? `data-contextrocket-locale="${item.locale}"` : ""} ${item.custom ? 'data-contextrocket-title="Caller title"' : ""}></contextrocket-chat></html>`,
          });
        } else if (
          url.origin === "http://localhost:39992" &&
          url.pathname === "/api/agent/a2a" &&
          route.request().method() === "POST"
        ) {
          attempts += 1;
          sent.push(route.request().postDataJSON());
          await route.fulfill(
            attempts === 1
              ? {
                  status: 503,
                  contentType: "application/json",
                  body: '{"error":{"message":"INTERNAL MUST NOT RENDER"}}',
                }
              : {
                  contentType: "text/event-stream",
                  body: sseBody([WORKING_FRAME, ARTIFACT_FRAME, FAILED_FRAME]),
                },
          );
        } else if (url.pathname === "/brand/cr-icon-red.svg") {
          await route.fulfill({ status: 204, body: "" });
        } else {
          unexpected.push(url.pathname);
          await route.abort();
        }
      });
      await page.goto("http://localhost:39992");
      const host = page.locator("contextrocket-chat");
      expect(await host.getAttribute("lang")).toBe(item.lang);
      await host.locator(".cr-launcher").click();
      expect(await host.locator(".cr-title").textContent()).toBe(item.title);
      expect(await host.locator(".cr-panel").getAttribute("aria-label")).toBe(
        item.title,
      );
      await host.locator(".cr-input").fill("Synthetic locale test");
      await host.locator(".cr-send").click();
      await host.locator(".cr-error:not([hidden])").waitFor();
      expect(await host.locator(".cr-error").textContent()).toBe(item.error);
      expect(
        await host
          .locator('.cr-message[data-role="assistant"]')
          .allTextContents(),
      ).toEqual(["Caller greeting"]);
      await host.locator(".cr-retry").click();
      await page.waitForFunction(
        () =>
          document
            .querySelector("contextrocket-chat")
            ?.shadowRoot?.querySelectorAll('.cr-message[data-role="assistant"]')
            .length === 2,
      );
      await host.locator(".cr-error:not([hidden])").waitFor();
      expect(
        await host
          .locator('.cr-message[data-role="assistant"]')
          .allTextContents(),
      ).toEqual(["Caller greeting", "Hello, "]);
      expect(await host.locator(".cr-error").textContent()).toBe(item.error);
      expect(sent[0]?.params.message.messageId).toMatch(/^[0-9a-f-]{36}$/);
      expect(sent[1]?.params.message.messageId).toBe(
        sent[0]?.params.message.messageId,
      );
      expect(sent[1]?.id).not.toBe(sent[0]?.id);
      await host.locator(".cr-input").fill("Synthetic locale test");
      await host.locator(".cr-send").click();
      await page.waitForFunction(
        () =>
          document
            .querySelector("contextrocket-chat")
            ?.shadowRoot?.querySelectorAll('.cr-message[data-role="user"]')
            .length === 3,
      );
      await host.locator(".cr-error:not([hidden])").waitFor();
      expect(sent[2]?.params.message.messageId).toMatch(/^[0-9a-f-]{36}$/);
      expect(sent[2]?.params.message.messageId).not.toBe(
        sent[0]?.params.message.messageId,
      );
      expect(await host.locator(".cr-footer span").textContent()).toBe(
        item.lang === "es"
          ? "Con tecnología de ContextRocket"
          : item.lang === "de"
            ? "Mit ContextRocket"
            : "Powered by ContextRocket",
      );
      if (item.host === "de-AT") {
        const demo = await page.evaluate<string>(
          "ContextRocketWidget.collectEmbedA2aSubscribe({mode:'demo',locale:'de'},{message:'Synthetic demo'}).then(events => events.filter(event => event.type === 'delta').map(event => event.text).join(''))",
        );
        expect(demo).toContain("Demo-Antwort von ContextRocket");
      }
      expect(unexpected).toEqual([]);
      await page.close();
    }
  } finally {
    await browser.close();
  }
}, 30000);
