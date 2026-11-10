import { copyFor } from "./copy";
import { parseAgentResponsePart } from "./agent-response";
import { parseSSE } from "./sse-parser";
import type {
  WidgetConfig,
  AgentResponseSpec,
  WidgetSendRequest,
  WidgetSourceRef,
  WidgetTransportEvent,
  WidgetTransportState,
  WidgetDemoCard,
} from "./types";

export type EmbedWidgetA2aFetch = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

export interface EmbedWidgetA2aPort {
  request(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
}

export function createEmbedWidgetA2aPort(
  fetchImpl: EmbedWidgetA2aFetch = fetch,
): EmbedWidgetA2aPort {
  return { request: (input, init) => fetchImpl(input, init) };
}

export function createInMemoryEmbedWidgetA2aPort(
  handler: EmbedWidgetA2aFetch,
): EmbedWidgetA2aPort {
  return { request: handler };
}

export const embedWidgetA2aPort = createEmbedWidgetA2aPort();

const TRANSPORT_STATES = new Set<string>([
  "submitted",
  "working",
  "input-required",
  "completed",
  "canceled",
  "failed",
]);

const A2A_PROTOCOL_VERSION = "1.0";

function demoResponseSpec(
  config: WidgetConfig,
  selectedComponent?: WidgetDemoCard,
): AgentResponseSpec {
  const copy = copyFor(config);
  const cards = {
    progress: { type: "Progress", props: { stage: copy.demoProgress, completed: 2, total: 4 }, children: [] },
    evidence: { type: "Evidence", props: { refs: [
      { title: copy.demoEvidenceTitle, excerpt: copy.demoEvidenceExcerpt },
      { title: copy.demoEvidenceTitleTwo, excerpt: copy.demoEvidenceExcerptTwo },
    ] }, children: [] },
    question: { type: "Question", props: { id: "demo-question", question: copy.demoQuestion, interactionId: "demo-interaction", questionId: "demo-question-1" }, children: [] },
    proposals: { type: "ProposalBatch", props: { views: [
      { id: "demo-proposal-1", workItemId: "demo-work-1", summary: copy.demoProposal },
      { id: "demo-proposal-2", workItemId: "demo-work-2", summary: copy.demoProposalTwo },
    ] }, children: [] },
    representation: { type: "Representation", props: { id: "demo-representation", organizationId: "demo-organization", representationId: "demo-artifact" }, children: [] },
  } satisfies Record<string, AgentResponseSpec["elements"][string]>;
  type DemoCardKey = keyof typeof cards;
  const componentKeys: Record<WidgetDemoCard, DemoCardKey> = {
    Evidence: "evidence",
    Progress: "progress",
    Question: "question",
    ProposalBatch: "proposals",
    Representation: "representation",
  };
  const focusedCard = selectedComponent
    ? componentKeys[selectedComponent]
    : null;
  const cardKeys: DemoCardKey[] = focusedCard
    ? [focusedCard]
    : ["progress", "evidence", "question", "proposals", "representation"];
  const elements = Object.fromEntries(
    cardKeys.map((key) => [key, cards[key]]),
  ) as AgentResponseSpec["elements"];
  elements.response = { type: "Response", props: {}, children: cardKeys };
  return {
    root: "response",
    elements,
  };
}

/** Normalize TASK_STATE_* / snake_case wire states to the widget shape. */
function normalizeTaskState(value: unknown): WidgetTransportState | null {
  if (typeof value !== "string" || !value) return null;
  const normalized = value
    .replace(/^TASK_STATE_/, "")
    .toLowerCase()
    .replace(/_/g, "-");
  return isTransportState(normalized) ? normalized : null;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const GENERIC_ERROR = "Something went wrong. Please try again.";
const INTERRUPTED_ERROR =
  "The connection ended before the answer was complete. Please try again.";
const UNSUPPORTED_CONTENT =
  "This content is not available in this chat. Please try again.";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isTransportState(value: unknown): value is WidgetTransportState {
  return typeof value === "string" && TRANSPORT_STATES.has(value);
}

function extractTextParts(container: unknown): string[] {
  if (!isRecord(container) || !Array.isArray(container.parts)) {
    return [];
  }

  // Wire parts are typeless one-of fields ({text}); read .text directly.
  return container.parts.flatMap((part) => {
    if (!isRecord(part) || typeof part.text !== "string" || !part.text) {
      return [];
    }
    return [part.text];
  });
}

function extractMetadata(container: unknown): Record<string, unknown> {
  if (!isRecord(container)) return {};
  return isRecord(container.metadata) ? container.metadata : {};
}

function extractSourceRefs(
  ...containers: unknown[]
): WidgetSourceRef[] | undefined {
  for (const container of containers) {
    const raw = extractMetadata(container).source_refs;
    if (!Array.isArray(raw)) continue;
    const refs = raw.flatMap((value): WidgetSourceRef[] => {
      if (!isRecord(value) || typeof value.sourceRefId !== "string") return [];
      return [
        {
          sourceRefId: value.sourceRefId.slice(0, 200),
          ...(typeof value.title === "string"
            ? { title: value.title.slice(0, 160) }
            : {}),
          ...(typeof value.excerpt === "string"
            ? { excerpt: value.excerpt.slice(0, 600) }
            : {}),
          ...(typeof value.url === "string"
            ? { url: value.url.slice(0, 2_000) }
            : {}),
        },
      ];
    });
    return refs.slice(0, 8);
  }
  return undefined;
}

function extractSuggestions(...containers: unknown[]): string[] | undefined {
  for (const container of containers) {
    const raw = extractMetadata(container).suggestions;
    if (!Array.isArray(raw)) continue;
    return raw
      .filter((value): value is string => typeof value === "string")
      .map((value) => value.trim().slice(0, 200))
      .filter(Boolean)
      .slice(0, 5);
  }
  return undefined;
}

function metadataEvent(
  state: WidgetTransportState,
  terminal: boolean,
  ...containers: unknown[]
): WidgetTransportEvent {
  const sourceRefs = extractSourceRefs(...containers);
  const suggestions = extractSuggestions(...containers);
  const structured = extractAgentResponse(...containers);
  return {
    type: "meta",
    state,
    terminal,
    ...(sourceRefs ? { sourceRefs } : {}),
    ...(suggestions ? { suggestions } : {}),
    ...(structured.spec ? { responseSpec: structured.spec } : {}),
    ...(structured.unavailable ? { unavailable: true } : {}),
  };
}

function extractAgentResponse(...containers: unknown[]): { spec?: import("./types").AgentResponseSpec; unavailable?: boolean } {
  for (const container of containers) {
    if (!isRecord(container) || !Array.isArray(container.parts)) continue;
    for (const part of container.parts) {
      const parsed = parseAgentResponsePart(part);
      if (parsed !== undefined) return parsed ? { spec: parsed } : { unavailable: true };
    }
  }
  return {};
}

function mapStatusUpdateEvents(
  update: Record<string, unknown>,
): WidgetTransportEvent[] {
  const status = isRecord(update.status) ? update.status : undefined;
  const state = normalizeTaskState(status?.state);

  if (!isTransportState(state)) {
    return [];
  }

  const taskId = typeof update.taskId === "string" ? update.taskId : undefined;
  const containers: unknown[] = [update, status, status?.message];

  if (state === "failed" || state === "canceled") {
    return [
      metadataEvent(state, true, ...containers),
      { type: "error", message: GENERIC_ERROR, reason: "generic" },
    ];
  }

  const sessionEvents = extractSessionEvents(...containers);

  if (state === "completed" || state === "input-required") {
    return [
      metadataEvent(state, true, ...containers),
      ...sessionEvents,
      { type: "done", taskId },
    ];
  }

  return [metadataEvent(state, false, ...containers), ...sessionEvents];
}

function mapArtifactUpdateEvents(
  update: Record<string, unknown>,
): WidgetTransportEvent[] {
  const artifact = isRecord(update.artifact) ? update.artifact : undefined;
  const events: WidgetTransportEvent[] = extractTextParts(artifact).map(
    (text) => ({
      type: "delta",
      text,
    }),
  );
  events.push(metadataEvent("working", false, update, artifact));
  return events;
}

function mapLegacyEnvelope(
  result: Record<string, unknown>,
): WidgetTransportEvent[] {
  const eventType = result.type;

  if (eventType === "TaskArtifactUpdateEvent") {
    const events: WidgetTransportEvent[] = extractTextParts(
      result.artifact,
    ).map((text) => ({
      type: "delta",
      text,
    }));
    events.push(metadataEvent("working", false, result, result.artifact));
    return events;
  }

  if (eventType !== "TaskStatusUpdateEvent") {
    return [{ type: "unsupported", message: UNSUPPORTED_CONTENT }];
  }

  const taskId = typeof result.id === "string" ? result.id : undefined;
  const status = isRecord(result.status) ? result.status : undefined;
  const state = normalizeTaskState(status?.state);

  if (!isTransportState(state)) {
    return [];
  }

  if (state === "failed" || state === "canceled") {
    return [
      metadataEvent(state, true, status, status?.message, result),
      { type: "error", message: GENERIC_ERROR, reason: "generic" },
    ];
  }

  const sessionEvents = extractSessionEvents(status, result);

  if (
    state === "completed" ||
    state === "input-required" ||
    result.final === true
  ) {
    return [
      metadataEvent(state, true, status, status?.message, result),
      ...sessionEvents,
      { type: "done", taskId },
    ];
  }

  return [metadataEvent(state, false, status, result), ...sessionEvents];
}

function mapEnvelopeToEvents(envelope: unknown): WidgetTransportEvent[] {
  if (!isRecord(envelope)) {
    return [{ type: "error", message: GENERIC_ERROR, reason: "generic" }];
  }

  if (envelope.error !== undefined && envelope.error !== null) {
    return [{ type: "error", message: GENERIC_ERROR, reason: "generic" }];
  }

  const result = envelope.result;
  if (!isRecord(result)) {
    return [];
  }

  // Current wire: statusUpdate / artifactUpdate result envelopes.
  if (isRecord(result.statusUpdate)) {
    return mapStatusUpdateEvents(result.statusUpdate);
  }

  if (isRecord(result.artifactUpdate)) {
    return mapArtifactUpdateEvents(result.artifactUpdate);
  }

  // Legacy wire: result.type discriminators (tolerance only).
  return mapLegacyEnvelope(result);
}

function extractSessionEvents(
  ...containers: unknown[]
): WidgetTransportEvent[] {
  for (const container of containers) {
    if (!isRecord(container)) {
      continue;
    }
    const metadata = isRecord(container.metadata)
      ? container.metadata
      : container;
    const raw =
      (typeof container.contextId === "string" && container.contextId) ||
      (typeof metadata.thread_id === "string" && metadata.thread_id) ||
      (typeof metadata.threadId === "string" && metadata.threadId) ||
      undefined;
    if (raw && UUID_PATTERN.test(raw)) {
      return [{ type: "session", threadId: raw }];
    }
  }
  return [];
}

function mapSseDataToEvents(data: string): WidgetTransportEvent[] {
  try {
    return mapEnvelopeToEvents(JSON.parse(data));
  } catch {
    return [{ type: "error", message: GENERIC_ERROR, reason: "generic" }];
  }
}

async function* streamTransportEvents(
  body: ReadableStream<Uint8Array> | null,
  signal?: AbortSignal,
): AsyncGenerator<WidgetTransportEvent> {
  if (!body) {
    return;
  }

  for await (const event of parseSSE(body.getReader(), signal)) {
    for (const mapped of mapSseDataToEvents(event.data)) {
      yield mapped;
    }
  }
}

async function* streamDemoEvents(
  config: WidgetConfig,
  request: WidgetSendRequest,
  signal?: AbortSignal,
): AsyncGenerator<WidgetTransportEvent> {
  const threadId = request.threadId ?? "demo-thread";
  yield { type: "meta", state: "working" };
  for (const token of copyFor(config).demoResponse.split(/(\s+)/)) {
    if (signal?.aborted) {
      return;
    }
    if (token) yield { type: "delta", text: token };
    await new Promise((resolve) => setTimeout(resolve, token.trim() ? 18 : 4));
  }
  yield {
    type: "meta",
    state: "working",
    responseSpec: demoResponseSpec(config, request.demoCard),
  };
  if (signal?.aborted) {
    return;
  }
  yield { type: "session", threadId };
  yield { type: "done", taskId: "demo-task" };
}

/**
 * Stream A2A `SendStreamingMessage` events from the embed API base.
 * Uses the public JSON-RPC envelope and calls `/api/agent/a2a` directly with
 * the website API key.
 */
const implicitMessageIds = new WeakMap<WidgetSendRequest, string>();

export async function* streamEmbedA2aSubscribe(
  config: WidgetConfig,
  request: WidgetSendRequest,
  port: EmbedWidgetA2aPort = embedWidgetA2aPort,
  signal?: AbortSignal,
): AsyncGenerator<WidgetTransportEvent> {
  if (signal?.aborted) {
    return;
  }

  if (config.mode === "demo") {
    yield* streamDemoEvents(config, request, signal);
    return;
  }
  const messageId =
    request.messageId ?? implicitMessageIds.get(request) ?? crypto.randomUUID();
  if (request.messageId == null) implicitMessageIds.set(request, messageId);
  const messageObj: Record<string, unknown> = {
    messageId,
    role: "ROLE_USER",
    parts: [{ text: request.message }],
  };

  if (request.threadId && UUID_PATTERN.test(request.threadId)) {
    messageObj.contextId = request.threadId;
  }

  const metadata: Record<string, unknown> = {};
  if (config.handle) {
    metadata.handle = config.handle;
  }

  const body = {
    jsonrpc: "2.0",
    id: `embed-chat-${crypto.randomUUID()}`,
    method: "SendStreamingMessage",
    params: {
      message: messageObj,
      metadata,
    },
  };

  const endpoint = `${config.apiBaseUrl!.replace(/\/$/, "")}/api/agent/a2a`;

  const headers: Record<string, string> = {
    "content-type": "application/json",
    accept: "text/event-stream",
    "a2a-version": A2A_PROTOCOL_VERSION,
  };
  if (config.apiKey) {
    headers["x-api-key"] = config.apiKey;
  }

  let response: Response;
  try {
    response = await port.request(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal,
    });
  } catch {
    if (signal?.aborted) {
      return;
    }
    yield { type: "error", message: GENERIC_ERROR, reason: "generic" };
    return;
  }

  if (!response.ok) {
    yield { type: "error", message: GENERIC_ERROR, reason: "generic" };
    return;
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("text/event-stream")) {
    yield { type: "error", message: GENERIC_ERROR, reason: "generic" };
    return;
  }

  let sawTerminalEvent = false;
  for await (const event of streamTransportEvents(response.body, signal)) {
    if (
      event.type === "done" ||
      event.type === "error" ||
      event.type === "unsupported" ||
      (event.type === "meta" && event.terminal)
    ) {
      sawTerminalEvent = true;
    }
    yield event;
  }

  // A cleanly closed HTTP stream is not proof that the task completed. Keep
  // partial text visible, but make the interruption explicit and retryable.
  if (!signal?.aborted && !sawTerminalEvent) {
    yield { type: "error", message: INTERRUPTED_ERROR, reason: "interrupted" };
  }
}

export async function collectEmbedA2aSubscribe(
  config: WidgetConfig,
  request: WidgetSendRequest,
  port: EmbedWidgetA2aPort = embedWidgetA2aPort,
  signal?: AbortSignal,
): Promise<WidgetTransportEvent[]> {
  const events: WidgetTransportEvent[] = [];
  for await (const event of streamEmbedA2aSubscribe(
    config,
    request,
    port,
    signal,
  )) {
    events.push(event);
  }
  return events;
}
