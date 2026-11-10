/**
 * A2A (Agent-to-Agent) protocol client for ContextRocket.
 *
 * Implements the A2A JSON-RPC 2.0 protocol (A2A-Version: 1.0) as defined in
 * the CR backend:
 * - POST /api/agent/a2a with method SendMessage (sync) or SendStreamingMessage (SSE)
 * - GET /.well-known/agent-card.json for discovery
 *
 * Wire format derived from:
 *   backend/app/modules/agent/a2a/current_contract.py
 *   backend/app/modules/agent/a2a/task_lifecycle.py
 *
 * Requests use the current wire: `ROLE_USER` roles, typeless one-of parts
 * (`{text}`), and the `A2A-Version: 1.0` header. Responses arrive as
 * `statusUpdate` / `artifactUpdate` envelopes with `TASK_STATE_*` values;
 * this client normalizes them into the stable event shapes below so
 * consumers depend on the current contract rather than historical wire
 * shapes.
 *
 * No backend-generated codegen used here because this client is used in the
 * standalone template which may not have a CR backend on the same origin.
 * Base URL comes from PUBLIC_CR_AGENT_URL or explicit client options.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export interface TextPart {
  /** Always "text" on normalized events; omitted on outgoing wire requests. */
  type?: "text";
  text: string;
}

export interface FileRefPart {
  type: "file_ref";
  media_id: string;
  filename?: string;
}

export type MessagePart = TextPart | FileRefPart;

export interface A2AMessage {
  /** Logical turn identity. Reuse unchanged for retries; new turns get new IDs. */
  messageId?: string;
  role: "ROLE_USER" | "ROLE_AGENT";
  parts: MessagePart[];
  /** Optional thread context for conversation continuity (contextId per A2A spec). */
  contextId?: string;
}

export interface A2ATaskParams {
  /** Optional caller-assigned task id; server assigns one if absent. */
  id?: string;
  /** Session / thread id for the A2A session. */
  sessionId?: string;
  message: A2AMessage;
  metadata?: {
    org_id?: string;
    thread_id?: string;
    scope?: Record<string, unknown>;
    [key: string]: unknown;
  };
}

// ── Normalized event shapes (stable consumer surface) ─────────────────────────

/**
 * TaskStatusUpdateEvent: state transitions (submitted, working, failed, completed,
 * input-required). Carries `final: true` on terminal states.
 *
 * Normalized from current-wire `statusUpdate` envelopes (TASK_STATE_* values)
 * A2A statusUpdate envelopes.
 */
export interface TaskStatusUpdateEvent {
  type: "TaskStatusUpdateEvent";
  id: string;
  status: {
    state:
      | "submitted"
      | "working"
      | "completed"
      | "failed"
      | "canceled"
      | "input-required";
    timestamp?: string;
    message?: {
      role: "agent";
      parts: TextPart[];
    };
  };
  final: boolean;
  metadata?: A2AEventMetadata;
}

/**
 * TaskArtifactUpdateEvent: streaming text chunks (token deltas).
 * `artifact.append = false` on first chunk; `true` on subsequent chunks.
 * `artifact.lastChunk = true` on the final artifact event before the
 * completed TaskStatusUpdateEvent.
 *
 * Normalized from current-wire `artifactUpdate` envelopes (append/lastChunk
 * live on the update, not the artifact).
 */
export interface TaskArtifactUpdateEvent {
  type: "TaskArtifactUpdateEvent";
  id: string;
  artifact: {
    name?: string;
    parts: TextPart[];
    index: number;
    append: boolean;
    lastChunk: boolean;
  };
  final: boolean;
  metadata?: A2AEventMetadata;
}

/**
 * Per-answer faithfulness verdict from the platform faithfulness check.
 *
 * Mirrored exactly from:
 *   backend/app/modules/agent/a2a/tasks.py  _faithfulness_metadata_from_verdict()
 *
 * Keys:
 *   grounded       (bool)   -- true when ALL material claims are corpus-supported.
 *   state          (string) -- "grounded" | "ungrounded" | "error"
 *   checked_claims (number) -- count of evaluated claims (0 on error/skip).
 *
 * Emitted only for closed-domain org turns; absent on open-domain / guest turns.
 */
export interface FaithfulnessVerdict {
  /** True when ALL material claims passed the corpus-support check. */
  grounded: boolean;
  /** Discriminated faithfulness state from the platform. */
  state: "grounded" | "ungrounded" | "error";
  /** Number of claims the platform evaluated (0 when state is "error"). */
  checked_claims: number;
}

/** Metadata attached to events that carry citations, tool calls, thread ids, etc. */
export interface A2AEventMetadata {
  customerSafe?: boolean;
  /** A2A-THREAD-1: server-assigned thread id; carry in contextId for follow-up turns. */
  thread_id?: string;
  /** Citation source references (ACS-3). */
  source_refs?: SourceRef[];
  /** Tool calls the agent invoked during this turn (A2A-SSE-2). */
  tool_calls?: ToolCallEvent[];
  /** Pending reviews requiring human approval (HITL). */
  pending_reviews?: PendingReview[];
  /** Artifacts produced during the turn. */
  artifacts?: ArtifactMeta[];
  /** i18n key for refusal messages. */
  content_key?: string;
  content_params?: Record<string, unknown>;
  /**
   * Per-answer faithfulness verdict from the platform faithfulness check.
   * Absent when the turn is not closed-domain or the check did not run.
   * Mirror of _faithfulness_metadata_from_verdict in tasks.py.
   */
  faithfulness?: FaithfulnessVerdict;
  /** Error reason (present on failed events). */
  reason?: string;
  error_key?: string;
  /** Runtime phase / status (progress events). */
  runtime_phase?: string;
  runtime_status?: string;
  [key: string]: unknown;
}

export interface SourceRef {
  sourceRefId: string;
  kind?: string;
  visibility?: string;
  title?: string;
  excerpt?: string;
  url?: string;
  score?: number;
}

export interface ToolCallEvent {
  name: string;
  status?: string;
  label_key?: string;
}

export interface PendingReview {
  work_item_id: string;
  skill_slug: string;
  summary?: string;
}

export interface ArtifactMeta {
  [key: string]: unknown;
}

/** The complete discriminated union of A2A SSE events. */
export type A2AEvent = TaskStatusUpdateEvent | TaskArtifactUpdateEvent;

/** JSON-RPC 2.0 success envelope wrapping an A2A event. */
interface JSONRPCSuccess {
  jsonrpc: "2.0";
  id: string | number | null;
  result: Record<string, unknown>;
}

/** JSON-RPC 2.0 error envelope. */
export interface JSONRPCErrorEnvelope {
  jsonrpc: "2.0";
  id: string | number | null;
  error: {
    code: number;
    message: string;
    data?: unknown;
  };
}

// ── Wire normalization helpers ────────────────────────────────────────────────

type TaskState =
  | "submitted"
  | "working"
  | "completed"
  | "failed"
  | "canceled"
  | "input-required";

const TASK_STATES = new Set<string>([
  "submitted",
  "working",
  "completed",
  "failed",
  "canceled",
  "input-required",
]);

/** Normalize TASK_STATE_* / snake_case wire states to the consumer shape. */
function normalizeTaskState(value: unknown): TaskState | null {
  if (typeof value !== "string" || !value) return null;
  const normalized = value
    .replace(/^TASK_STATE_/, "")
    .toLowerCase()
    .replace(/_/g, "-");
  return TASK_STATES.has(normalized) ? (normalized as TaskState) : null;
}

function isTerminalState(state: TaskState): boolean {
  return (
    state === "completed" ||
    state === "failed" ||
    state === "canceled" ||
    state === "input-required"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** Map wire parts (typeless one-of `{text}`) to normalized TextParts. */
function normalizeTextParts(value: unknown): TextPart[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((part): TextPart[] => {
    if (!isRecord(part) || typeof part.text !== "string" || !part.text) {
      return [];
    }
    return [{ type: "text", text: part.text }];
  });
}

// ── SSE parser ────────────────────────────────────────────────────────────────

/**
 * Parse a raw SSE `data:` line into a discriminated A2AEvent union.
 *
 * The current wire format from the CR backend is a JSON-RPC 2.0 success
 * envelope whose result carries a `statusUpdate` or `artifactUpdate`:
 *   { "jsonrpc": "2.0", "id": ..., "result": { "statusUpdate": { ... } } }
 * Returns null when the line should be ignored (comment, empty, non-data).
 * Throws A2AParseError when the line is malformed or unknown type.
 */
export class A2AParseError extends Error {
  constructor(
    message: string,
    public readonly raw: string,
  ) {
    super(message);
    this.name = "A2AParseError";
  }
}

function mapStatusUpdate(update: Record<string, unknown>): A2AEvent | null {
  const state = normalizeTaskState(
    isRecord(update.status) ? update.status.state : undefined,
  );
  if (!state) return null;

  const status = isRecord(update.status) ? update.status : {};
  const message = isRecord(status.message)
    ? {
        role: "agent" as const,
        parts: normalizeTextParts(status.message.parts),
      }
    : undefined;

  const metadata = isRecord(update.metadata)
    ? (update.metadata as A2AEventMetadata)
    : undefined;

  return {
    type: "TaskStatusUpdateEvent",
    id: typeof update.taskId === "string" ? update.taskId : "",
    status: {
      state,
      ...(typeof status.timestamp === "string"
        ? { timestamp: status.timestamp }
        : {}),
      ...(message && message.parts.length > 0 ? { message } : {}),
    },
    final: isTerminalState(state),
    ...(metadata ? { metadata } : {}),
  };
}

function mapArtifactUpdate(update: Record<string, unknown>): A2AEvent | null {
  const artifact = isRecord(update.artifact) ? update.artifact : {};
  const parts = normalizeTextParts(artifact.parts);
  if (parts.length === 0) return null;

  const artifactMeta = isRecord(artifact.metadata) ? artifact.metadata : {};
  const metadata = isRecord(update.metadata)
    ? (update.metadata as A2AEventMetadata)
    : undefined;

  return {
    type: "TaskArtifactUpdateEvent",
    id: typeof update.taskId === "string" ? update.taskId : "",
    artifact: {
      ...(typeof artifact.name === "string" ? { name: artifact.name } : {}),
      parts,
      index: typeof artifactMeta.index === "number" ? artifactMeta.index : 0,
      append: update.append === true,
      lastChunk: update.lastChunk === true,
    },
    final: false,
    ...(metadata ? { metadata } : {}),
  };
}

export function parseA2AEvent(line: string): A2AEvent | null {
  if (!line.startsWith("data:")) {
    return null;
  }

  const raw = line.slice("data:".length).trim();
  if (!raw || raw === "[DONE]") {
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new A2AParseError(`Invalid JSON in SSE data line`, raw);
  }

  // Unwrap JSON-RPC envelope: result carries the actual event.
  if (!isRecord(parsed)) return null;
  const envelope = parsed;
  if (envelope.jsonrpc !== "2.0") return null;
  let event: Record<string, unknown>;

  if (
    "result" in envelope &&
    typeof envelope.result === "object" &&
    envelope.result !== null
  ) {
    event = envelope.result as Record<string, unknown>;
  } else if ("error" in envelope) {
    // JSON-RPC error envelope -- surface as a failed TaskStatusUpdateEvent.
    const err = isRecord(envelope.error) ? envelope.error : {};
    return {
      type: "TaskStatusUpdateEvent",
      id: String(envelope.id ?? ""),
      status: {
        state: "failed",
        timestamp: new Date().toISOString(),
      },
      final: true,
      metadata: {
        reason: String(err.message ?? "ERROR_A2A_INTERNAL"),
        error_key: "ERROR_A2A_INTERNAL",
      },
    };
  } else {
    // Streaming A2A events use JSON-RPC result envelopes. Ignore unrelated
    // payloads instead of guessing at non-standard wire shapes.
    return null;
  }

  // Current wire: statusUpdate / artifactUpdate envelopes.
  if (isRecord(event.statusUpdate)) {
    return mapStatusUpdate(event.statusUpdate);
  }

  if (isRecord(event.artifactUpdate)) {
    return mapArtifactUpdate(event.artifactUpdate);
  }

  // Unknown current-contract event -- caller decides how to surface it.
  return null;
}

// ── Request builder ───────────────────────────────────────────────────────────

/** Outgoing wire methods (A2A 1.0). Retired: tasks/send, tasks/sendSubscribe. */
type WireMethod = "SendMessage" | "SendStreamingMessage";

const implicitMessageIds = new WeakMap<A2AMessage, string>();

function buildJSONRPCRequest(
  method: WireMethod,
  params: A2ATaskParams,
): string {
  // Caller messages may be frozen; keep implicit retry identity outside them.
  const messageId =
    params.message.messageId ??
    implicitMessageIds.get(params.message) ??
    crypto.randomUUID();
  if (params.message.messageId == null)
    implicitMessageIds.set(params.message, messageId);
  // Wire request parts are typeless one-of fields: {text}, never {type, text}.
  const wireParams = {
    ...params,
    message: {
      ...params.message,
      messageId,
      parts: params.message.parts.map((part) => {
        if ("text" in part) {
          return { text: part.text };
        }
        return part;
      }),
    },
  };
  return JSON.stringify({
    jsonrpc: "2.0",
    id: params.id ?? crypto.randomUUID(),
    method,
    params: wireParams,
  });
}

// ── A2A client ────────────────────────────────────────────────────────────────

export interface A2AClientOptions {
  /** Base URL of the CR agent backend, e.g. https://api.example.com. */
  baseUrl: string;
  /** Website API key for anonymous browser A2A; never a server secret. */
  apiKey?: string;
  /** Public organization handle for anonymous browser A2A. */
  handle?: string;
  /** JWT bearer token for authenticated requests. */
  bearerToken?: string;
  /**
   * @deprecated The guest tier was removed server-side. This option is
   * accepted for source compatibility but ignored; it emits a console warning
   * when set. Remove it from callers.
   */
  guestSessionId?: string;
}

const A2A_ENDPOINT = "/api/agent/a2a";
const AGENT_CARD_ENDPOINT = "/.well-known/agent-card.json";
const A2A_PROTOCOL_VERSION = "1.0";

let guestSessionIdWarned = false;

function warnGuestSessionIdIgnored(): void {
  if (guestSessionIdWarned) return;
  guestSessionIdWarned = true;
  console.warn(
    "[@contextrocket/sdk] guestSessionId is deprecated and ignored: the guest tier was removed server-side. Use bearerToken or the website API key + handle instead.",
  );
}

/** Test seam: reset the once-per-process deprecation warning. */
export function resetGuestSessionIdWarning(): void {
  guestSessionIdWarned = false;
}

function buildHeaders(
  opts: A2AClientOptions,
  extra?: Record<string, string>,
): HeadersInit {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
    "A2A-Version": A2A_PROTOCOL_VERSION,
    ...extra,
  };
  if (opts.bearerToken) {
    headers["Authorization"] = `Bearer ${opts.bearerToken}`;
  }
  if (opts.apiKey) {
    headers["X-Api-Key"] = opts.apiKey;
  }
  return headers;
}

/**
 * Fetch the generic agent card from /.well-known/agent-card.json.
 * Pass a handle to use ContextRocket's handle-bound card instead.
 * No auth required per A2A spec.
 */
export async function fetchAgentCard(
  baseUrl: string,
  handle?: string,
): Promise<unknown> {
  const endpoint = handle
    ? `/.well-known/agent-card/${encodeURIComponent(handle)}.json`
    : AGENT_CARD_ENDPOINT;
  const resp = await fetch(`${baseUrl.replace(/\/$/, "")}${endpoint}`, {
    method: "GET",
    headers: { Accept: "application/json" },
  });
  if (!resp.ok) {
    throw new Error(`Agent card fetch failed: ${resp.status}`);
  }
  return resp.json();
}

/**
 * Send a non-streaming task (SendMessage).
 * The current wire wraps the Task in `{task}`; unwrap it and return the
 * Task object.
 */
export async function sendTask(
  opts: A2AClientOptions,
  params: A2ATaskParams,
): Promise<Record<string, unknown>> {
  if (opts.guestSessionId) warnGuestSessionIdIgnored();
  const url = `${opts.baseUrl.replace(/\/$/, "")}${A2A_ENDPOINT}`;
  const body = buildJSONRPCRequest("SendMessage", params);

  const resp = await fetch(url, {
    method: "POST",
    headers: buildHeaders(opts),
    body,
  });

  if (!resp.ok) {
    throw new Error(
      `A2A SendMessage failed: ${resp.status} ${resp.statusText}`,
    );
  }

  const data = (await resp.json()) as JSONRPCSuccess | JSONRPCErrorEnvelope;

  if ("error" in data && data.error) {
    throw new Error(data.error.message ?? "ERROR_A2A_INTERNAL");
  }

  const result = (data as JSONRPCSuccess).result as Record<string, unknown>;
  // Current wire: {task: {...}}. Legacy tolerance: bare task object.
  if (isRecord(result.task)) {
    return result.task;
  }
  return result;
}

/**
 * Open a streaming task (SendStreamingMessage).
 *
 * Returns an AsyncGenerator yielding parsed A2AEvent objects. The generator
 * completes when the stream closes or a terminal event (final: true) is received.
 * Callers should call abort() on the AbortController to cancel mid-stream.
 */
export async function* streamTask(
  opts: A2AClientOptions,
  params: A2ATaskParams,
  signal?: AbortSignal,
): AsyncGenerator<A2AEvent> {
  if (opts.guestSessionId) warnGuestSessionIdIgnored();
  const url = `${opts.baseUrl.replace(/\/$/, "")}${A2A_ENDPOINT}`;
  const body = buildJSONRPCRequest("SendStreamingMessage", params);

  const resp = await fetch(url, {
    method: "POST",
    headers: buildHeaders(opts, { Accept: "text/event-stream" }),
    body,
    signal,
  });

  if (!resp.ok) {
    throw new Error(
      `A2A SendStreamingMessage failed: ${resp.status} ${resp.statusText}`,
    );
  }

  if (!resp.body) {
    throw new Error("A2A stream response has no body");
  }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      // Keep the incomplete last line in the buffer.
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        try {
          const event = parseA2AEvent(trimmed);
          if (event !== null) {
            yield event;
            if (event.final) {
              return;
            }
          }
        } catch {
          // Non-fatal parse errors skip the line; the stream continues.
        }
      }
    }

    // Process any remaining buffer content.
    if (buffer.trim()) {
      try {
        const event = parseA2AEvent(buffer.trim());
        if (event !== null) {
          yield event;
        }
      } catch {
        // Ignore trailing parse errors.
      }
    }
  } finally {
    reader.cancel().catch(() => {});
  }
}

/**
 * Build an A2ATaskParams object for a simple text turn.
 *
 * @param text     User message text.
 * @param opts     Optional thread/org/handle context for continuity.
 *
 * Anonymous browser turns carry the organization handle in `metadata.handle`.
 * Authentication remains separate: registered sessions use their bearer
 * token, while the website API key is only a publishable origin-bound
 * browser credential.
 */
export function buildTextTurnParams(
  text: string,
  opts?: {
    threadId?: string;
    /** Reuse the original logical message ID when reconstructing a retry. */
    messageId?: string;
    orgId?: string;
    /** @deprecated Ignored; see A2AClientOptions.guestSessionId. */
    guestSessionId?: string;
    scope?: Record<string, unknown>;
    /** Public organization handle for anonymous browser requests. */
    handle?: string;
  },
): A2ATaskParams {
  if (opts?.guestSessionId) warnGuestSessionIdIgnored();

  const message: A2AMessage = {
    messageId: opts?.messageId ?? crypto.randomUUID(),
    role: "ROLE_USER",
    parts: [{ text }],
  };

  if (opts?.threadId) {
    message.contextId = opts.threadId;
  }

  const metadata: A2ATaskParams["metadata"] = {};
  if (opts?.threadId) metadata.thread_id = opts.threadId;
  if (opts?.orgId) metadata.org_id = opts.orgId;
  if (opts?.scope) metadata.scope = opts.scope;
  if (opts?.handle) metadata.handle = opts.handle;

  return {
    message,
    ...(Object.keys(metadata).length > 0 ? { metadata } : {}),
  };
}
