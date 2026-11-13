import type { AgentResponseSpec } from "@contextrocket/sdk/json-render";
export type { AgentResponseSpec } from "@contextrocket/sdk/json-render";

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
  responseSpec?: AgentResponseSpec;
  responseUnavailable?: boolean;
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
export type WidgetSubjectKind = "company" | "person";

/** Render types exposed by the current public-safe A2A JSON Render catalog. */
export type WidgetDemoCard =
  | "Evidence"
  | "Progress"
  | "Question"
  | "ProposalBatch"
  | "Representation";

export type WidgetFailureReason = "generic" | "interrupted" | "unsupported";

export type WidgetTransportEvent =
  | { type: "delta"; text: string }
  | { type: "done"; taskId?: string }
  | { type: "error"; message: string; reason?: WidgetFailureReason }
  | {
      type: "meta";
      state: WidgetTransportState;
      terminal?: boolean;
      sourceRefs?: WidgetSourceRef[];
      suggestions?: string[];
      responseSpec?: AgentResponseSpec;
      unavailable?: boolean;
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
  /** Public company or person handle used to bind A2A to one identity. */
  handle?: string;
  /** Typed identity segment for the handle. Defaults to company. */
  subjectKind?: WidgetSubjectKind;
  accentColor?: string;
  /** Launcher background: `pink` (default), `ink`, or a contrast-checked hex color. */
  launcherColor?: string;
  /** Resolved white or Ink icon color for the selected launcher background. */
  launcherForeground?: string;
  /** Optional customer portrait displayed in the launcher instead of the rocket. */
  launcherAvatarUrl?: string;
  greeting?: string;
  title?: string;
  /** Optional site-specific assistant portrait shown within the chat panel. */
  agentAvatarUrl?: string;
  ref?: string;
  backgroundColor?: string;
  foregroundColor?: string;
  surfaceColor?: string;
  mutedColor?: string;
  borderColor?: string;
  poweredByLogo?: "ink" | "white";
  suggestions?: string[];
  position?: "bottom-right" | "bottom-left";
  /** Show a full-screen toggle in the chat header. */
  fullscreen?: boolean;
  /** Open expanded when the visitor launches the chat. */
  fullscreenOnOpen?: boolean;
  /** Open the chat over the full viewport as soon as the widget mounts. */
  fullscreenOnLoad?: boolean;
  /** Auto/omitted uses supported host document language (including regional tags), else English. */
  locale?: "auto" | "en" | "es" | "de" | "zh";
  /** Keep the widget hidden until the host site's consent prompt is resolved. */
  consentGate?: boolean;
}

export interface WidgetSendRequest {
  /** Logical user turn identity, preserved for every retry of this request. */
  messageId?: string;
  message: string;
  threadId?: string;
  /** Local demo affordance; never included in live A2A requests. */
  demoCard?: WidgetDemoCard;
}
