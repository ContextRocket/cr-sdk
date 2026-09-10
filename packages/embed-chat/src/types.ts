export type WidgetChatStatus =
  | "idle"
  | "streaming"
  | "complete"
  | "input-required"
  | "canceled"
  | "error";

export type WidgetChatRole = "user" | "assistant";

export interface WidgetChatMessage {
  id: string;
  role: WidgetChatRole;
  content: string;
  sourceRefs?: WidgetSourceRef[];
  suggestions?: string[];
}

export interface WidgetSourceRef {
  sourceRefId: string;
  title?: string;
  excerpt?: string;
  url?: string;
}

export type WidgetTransportState =
  | "submitted"
  | "working"
  | "input-required"
  | "completed"
  | "canceled"
  | "failed";

export type WidgetMode = "demo" | "live";

export type WidgetTransportEvent =
  | { type: "delta"; text: string }
  | { type: "done"; taskId?: string }
  | { type: "error"; message: string }
  | {
      type: "meta";
      state: WidgetTransportState;
      terminal?: boolean;
      sourceRefs?: WidgetSourceRef[];
      suggestions?: string[];
    }
  | { type: "unsupported"; message: string }
  | { type: "session"; threadId: string };

export interface WidgetConfig {
  /** Website API key; never a server-side credential. */
  apiKey?: string;
  /** Direct ContextRocket API base for live mode. */
  apiBaseUrl?: string;
  /** `demo` is dependency-free; `live` calls the API from the browser. */
  mode: WidgetMode;
  /** Public organization handle used by the A2A metadata contract. */
  handle?: string;
  accentColor?: string;
  greeting?: string;
  title?: string;
  ref?: string;
  theme?: "system" | "light" | "dark";
  position?: "bottom-right" | "bottom-left";
  locale?: "auto" | "en" | "es" | "de";
}

export interface WidgetSendRequest {
  message: string;
  threadId?: string;
}
