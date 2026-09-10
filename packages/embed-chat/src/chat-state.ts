import type {
  WidgetChatMessage,
  WidgetChatStatus,
  WidgetTransportEvent,
  WidgetTransportState,
} from "./types";

export interface WidgetChatState {
  status: WidgetChatStatus;
  messages: WidgetChatMessage[];
  errorMessage: string | null;
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
      };

    case "unsupported":
      return {
        ...state,
        status: "error",
        errorMessage: event.message,
      };

    case "done":
      return {
        ...state,
        status: "complete",
      };

    case "meta": {
      const messages =
        event.sourceRefs || event.suggestions
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
