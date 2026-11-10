import type {
  WidgetChatMessage,
  WidgetFailureReason,
  WidgetChatStatus,
  WidgetTransportEvent,
  WidgetTransportState,
} from "./types";

export interface WidgetChatState {
  status: WidgetChatStatus;
  messages: WidgetChatMessage[];
  errorMessage: string | null;
  errorReason?: WidgetFailureReason | null;
  threadId: string | null;
  transportState: WidgetTransportState | null;
}

export function createInitialChatState(greeting?: string): WidgetChatState {
  const messages: WidgetChatMessage[] = greeting
    ? [
        {
          id: "greeting",
          role: "assistant",
          content: greeting,
        },
      ]
    : [];

  return {
    status: "idle",
    messages,
    errorMessage: null,
    errorReason: null,
    threadId: null,
    transportState: null,
  };
}

let messageCounter = 0;

export function nextMessageId(prefix: string): string {
  messageCounter += 1;
  return `${prefix}-${messageCounter}`;
}

/** Reset counter for deterministic tests. */
export function resetMessageIdCounter(): void {
  messageCounter = 0;
}

export function beginSend(
  state: WidgetChatState,
  userText: string,
): {
  state: WidgetChatState;
  assistantMessageId: string;
} {
  const userMessageId = nextMessageId("user");
  const assistantMessageId = nextMessageId("assistant");

  return {
    assistantMessageId,
    state: {
      ...state,
      status: "streaming",
      errorMessage: null,
      errorReason: null,
      messages: [
        ...state.messages,
        { id: userMessageId, role: "user", content: userText },
        { id: assistantMessageId, role: "assistant", content: "" },
      ],
    },
  };
}

export function applyTransportEvent(
  state: WidgetChatState,
  event: WidgetTransportEvent,
  assistantMessageId: string,
): WidgetChatState {
  switch (event.type) {
    case "delta":
      if (!event.text) {
        return state;
      }
      return {
        ...state,
        messages: state.messages.map((message) =>
          message.id === assistantMessageId && message.role === "assistant"
            ? { ...message, content: message.content + event.text }
            : message,
        ),
      };

    case "session":
      return { ...state, threadId: event.threadId };

    case "error":
      return {
        ...state,
        status: "error",
        errorMessage: event.message,
        errorReason: event.reason ?? "generic",
      };

    case "unsupported":
      return {
        ...state,
        status: "error",
        errorMessage: event.message,
        errorReason: "unsupported",
      };

    case "done":
      return {
        ...state,
        status: "complete",
      };

    case "meta": {
      const messages =
        event.sourceRefs || event.suggestions || event.responseSpec || event.unavailable
          ? state.messages.map((message) =>
              message.id === assistantMessageId && message.role === "assistant"
                ? {
                    ...message,
                    ...(event.sourceRefs
                      ? { sourceRefs: event.sourceRefs }
                      : {}),
                    ...(event.suggestions
                      ? { suggestions: event.suggestions }
                      : {}),
                    ...(event.responseSpec ? { responseSpec: event.responseSpec } : {}),
                    ...(event.unavailable ? { responseSpec: undefined } : {}),
                    ...(event.unavailable ? { responseUnavailable: true } : {}),
                  }
                : message,
            )
          : state.messages;
      return {
        ...state,
        messages,
        transportState: event.state,
        status:
          event.terminal && event.state === "input-required"
            ? "input-required"
            : event.terminal && event.state === "canceled"
              ? "canceled"
              : state.status,
      };
    }

    default:
      return state;
  }
}

export function canSend(state: WidgetChatState): boolean {
  return state.status !== "streaming";
}
