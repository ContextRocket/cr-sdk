import {
  mountFromScriptTag,
  registerContextRocketChatElement,
} from "./element";

export { buildPoweredByHref, parseWidgetConfig } from "./config";
export {
  applyTransportEvent,
  beginSend,
  canSend,
  createInitialChatState,
  resetMessageIdCounter,
} from "./chat-state";
export {
  collectEmbedA2aSubscribe,
  streamEmbedA2aSubscribe,
} from "./a2a-transport";
export {
  ContextRocketChatElement,
  mountFromScriptTag,
  registerContextRocketChatElement,
} from "./element";
export type {
  WidgetChatMessage,
  WidgetChatStatus,
  WidgetConfig,
  WidgetSendRequest,
  WidgetSourceRef,
  WidgetTransportEvent,
  WidgetTransportState,
} from "./types";
export { renderMarkdown } from "./markdown";

registerContextRocketChatElement();

if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => mountFromScriptTag());
  } else {
    mountFromScriptTag();
  }
}
