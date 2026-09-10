/**
 * A2A (Agent-to-Agent) protocol client for ContextRocket.
 *
 * Implements the A2A JSON-RPC 2.0 protocol as defined in the CR backend:
 * - POST /api/agent/a2a with method tasks/send (sync) or tasks/sendSubscribe (SSE)
 * - GET /.well-known/agent-card.json for discovery
 *
 * Wire format derived from:
 *   backend/app/modules/agent/a2a/types.py
 *   backend/app/modules/agent/a2a/tasks.py
 *
 * No backend-generated codegen used here because this client is used in the
 * standalone template which may not have a CR backend on the same origin.
 * Base URL comes from NEXT_PUBLIC_CR_AGENT_URL.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export interface TextPart {
  type: "text";
  text: string;
}

export interface FileRefPart {
  type: "file_ref";
  media_id: string;
  filename?: string;
}

export type MessagePart = TextPart | FileRefPart;

export interface A2AMessage {
  role: "user" | "agent";
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
    guest_session_id?: string;
    [key: string]: unknown;
  };
}

// ── Discriminated union of SSE events emitted by tasks/sendSubscribe ──────────

/**
 * TaskStatusUpdateEvent: state transitions (submitted, working, failed, completed,
 * input-required). Carries `final: true` on terminal states.
 *
 * Derived from tasks.py: _completed_event, _runtime_failure_event, _runtime_progress_event
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
 * Derived from tasks.py: _artifact_chunk_event
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

// ── SSE parser ────────────────────────────────────────────────────────────────

/**
 * Parse a raw SSE `data:` line into a discriminated A2AEvent union.
 *
 * The wire format from the CR backend is a JSON-RPC 2.0 success envelope:
 *   { "jsonrpc": "2.0", "id": ..., "result": { "type": "...", ... } }
 *
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
  const envelope = parsed as Record<string, unknown>;
  let event: Record<string, unknown>;

  if (
    "result" in envelope &&
    typeof envelope.result === "object" &&
    envelope.result !== null
  ) {
    event = envelope.result as Record<string, unknown>;
  } else if ("error" in envelope) {
    // JSON-RPC error envelope -- surface as a failed TaskStatusUpdateEvent.
    const err = envelope.error as Record<string, unknown>;
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
    // Direct event (not wrapped) -- tolerate for compatibility.
    event = envelope;
  }

  const type = event.type;

  if (type === "TaskStatusUpdateEvent") {
    return event as unknown as TaskStatusUpdateEvent;
  }

  if (type === "TaskArtifactUpdateEvent") {
    return event as unknown as TaskArtifactUpdateEvent;
  }

  // Unknown type -- not an error the parser should hard-fail on; caller decides.
  return null;
}

// ── Request builder ───────────────────────────────────────────────────────────

function buildJSONRPCRequest(
  method: "tasks/send" | "tasks/sendSubscribe",
  params: A2ATaskParams,
): string {
  return JSON.stringify({
    jsonrpc: "2.0",
    id: params.id ?? `cr-${Date.now()}`,
    method,
    params,
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
  /** JWT bearer token for authenticated requests; omit for guest sessions. */
  bearerToken?: string;
  /**
   * Guest session id cookie value. The server reads this from the cookie jar
   * automatically in browsers; pass here for non-browser clients or when
   * the caller manages credentials explicitly.
   */
  guestSessionId?: string;
}

const A2A_ENDPOINT = "/api/agent/a2a";
const AGENT_CARD_ENDPOINT = "/.well-known/agent-card.json";

function buildHeaders(
  opts: A2AClientOptions,
  extra?: Record<string, string>,
): HeadersInit {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
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
 * Send a non-streaming task (tasks/send).
 * Returns the completed Task object from the JSON-RPC result.
 */
export async function sendTask(
  opts: A2AClientOptions,
  params: A2ATaskParams,
): Promise<Record<string, unknown>> {
  const url = `${opts.baseUrl.replace(/\/$/, "")}${A2A_ENDPOINT}`;
  const body = buildJSONRPCRequest("tasks/send", params);

  const resp = await fetch(url, {
    method: "POST",
    headers: buildHeaders(opts),
    body,
  });

  if (!resp.ok) {
    throw new Error(`A2A tasks/send failed: ${resp.status} ${resp.statusText}`);
  }

  const data = (await resp.json()) as JSONRPCSuccess | JSONRPCErrorEnvelope;

  if ("error" in data && data.error) {
    throw new Error(data.error.message ?? "ERROR_A2A_INTERNAL");
  }

  return (data as JSONRPCSuccess).result as Record<string, unknown>;
}

/**
 * Open a streaming task (tasks/sendSubscribe).
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
  const url = `${opts.baseUrl.replace(/\/$/, "")}${A2A_ENDPOINT}`;
  const body = buildJSONRPCRequest("tasks/sendSubscribe", params);

  const resp = await fetch(url, {
    method: "POST",
    headers: buildHeaders(opts, { Accept: "text/event-stream" }),
    body,
    signal,
  });

  if (!resp.ok) {
    throw new Error(
      `A2A tasks/sendSubscribe failed: ${resp.status} ${resp.statusText}`,
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
 * Authentication remains separate: registered and guest sessions continue to
 * use their bearer/session credentials, while the website API key is only a
 * publishable origin-bound browser credential.
 */
export function buildTextTurnParams(
  text: string,
  opts?: {
    threadId?: string;
    orgId?: string;
    guestSessionId?: string;
    scope?: Record<string, unknown>;
    /** Public organization handle for anonymous browser requests. */
    handle?: string;
  },
): A2ATaskParams {
  const message: A2AMessage = {
    role: "user",
    parts: [{ type: "text", text }],
  };

  if (opts?.threadId) {
    message.contextId = opts.threadId;
  }

  const metadata: A2ATaskParams["metadata"] = {};
  if (opts?.threadId) metadata.thread_id = opts.threadId;
  if (opts?.orgId) metadata.org_id = opts.orgId;
  if (opts?.guestSessionId) metadata.guest_session_id = opts.guestSessionId;
  if (opts?.scope) metadata.scope = opts.scope;
  if (opts?.handle) metadata.handle = opts.handle;

  return {
    message,
    ...(Object.keys(metadata).length > 0 ? { metadata } : {}),
  };
}
