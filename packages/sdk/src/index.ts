/**
 * @contextrocket/sdk — public browser integration surface for ContextRocket.
 *
 * Includes the A2A wire client and the higher-level createCRClient API.
 * Apps and widgets should import from this package only.
 */

export { mockStreamTask } from "./adapters/a2a-mock.js";

export {
  AGENT_RESPONSE_CATALOG,
  parseAgentResponsePart,
} from "./json-render.js";
export type {
  AgentResponseChild,
  AgentResponseDataPart,
  AgentResponseEvidenceRef,
  AgentResponseProposalView,
  AgentResponseRoot,
  AgentResponseSpec,
} from "./json-render.js";

export { resolveCRConfig } from "./config.js";
export type { CRConfig, CRSubjectKind } from "./config.js";

export {
  crIdentityPath,
  crIdentityUrl,
} from "./identity-urls.js";
export type { CRIdentityResource } from "./identity-urls.js";

export {
  getStoredToken,
  setStoredToken,
  clearStoredToken,
  ensureToken,
} from "./credentials.js";

export {
  createCredentialsPort,
  createInMemoryCredentialsPort,
} from "./credentials-port.js";
export type { CredentialsPort } from "./credentials-port.js";

export {
  createContactFormController,
  ContactFormError,
  mapContactFormData,
  extractContactAttribution,
  submitContactForm,
  submitContactFormWithAttribution,
} from "./contact-form.js";
export type {
  ContextRocketBrowserSDK,
  ContactIntent,
  ContactFormController,
  ContactAttribution,
  ContactFormFieldNames,
  ContactFormData,
  ContactFormJsonValue,
  ContactFormReceipt,
  MapContactFormDataOptions,
  SubmitContactFormOptions,
  SubmitContactFormWithAttributionOptions,
} from "./contact-form.js";

export {
  CONSENT_CHANGE_EVENT,
  CONSENT_STORAGE_KEY,
  OPEN_SETTINGS_EVENT,
  emptyConsentPreferences,
  readConsentPreferences,
  saveConsentPreferences,
} from "./site-consent.js";
export type {
  ConsentCategory,
  ConsentChoice,
  ConsentPreferences,
} from "./site-consent.js";
export {
  initializeSiteIntegrations,
} from "./site-integrations.js";
export type {
  SiteIntegrationConfig,
  SiteIntegrationsConfig,
} from "./site-integrations.js";

export type {
  A2AClientOptions,
  A2AEvent,
  A2ATaskParams,
  A2AMessage,
  A2AResponsePart,
  AgentUIDataPart,
  MessagePart,
  TextPart,
  FileRefPart,
  TaskStatusUpdateEvent,
  TaskArtifactUpdateEvent,
  SourceRef,
  ToolCallEvent,
  PendingReview,
  FaithfulnessVerdict,
  A2AEventMetadata,
} from "./a2a-client.js";

export {
  fetchAgentCard,
  buildTextTurnParams,
  streamTask,
  sendTask,
  parseA2AEvent,
  A2AParseError,
} from "./a2a-client.js";

import { streamTask, fetchAgentCard } from "./a2a-client.js";
import type {
  A2AClientOptions,
  A2ATaskParams,
  A2AEvent,
} from "./a2a-client.js";
import { mockStreamTask } from "./adapters/a2a-mock.js";
import { ensureToken } from "./credentials.js";
import type { CRConfig } from "./config.js";

export interface CRClient {
  streamTurn(
    params: A2ATaskParams,
    signal?: AbortSignal,
  ): AsyncGenerator<A2AEvent>;
  agentCard(): Promise<unknown>;
  ensureToken(locale?: string): Promise<string | null>;
  readonly agentUrl: string;
}

export function createCRClient(config: CRConfig): CRClient {
  const {
    agentUrl,
    backendEnabled,
    backendUrl,
    handle,
    subjectKind,
    apiKey,
  } = config;

  return {
    agentUrl,

    async ensureToken(locale?: string) {
      return ensureToken(backendEnabled, backendUrl, locale);
    },

    async *streamTurn(params: A2ATaskParams, signal?: AbortSignal) {
      if (!agentUrl) {
        yield* mockStreamTask(params, signal);
        return;
      }

      const token = await ensureToken(backendEnabled, backendUrl);
      const opts: A2AClientOptions = {
        baseUrl: agentUrl,
        handle,
        subjectKind,
        apiKey: token ? undefined : apiKey,
        bearerToken: token ?? undefined,
      };
      yield* streamTask(opts, params, signal);
    },

    async agentCard() {
      if (!agentUrl) return null;
      return fetchAgentCard(agentUrl, handle, subjectKind);
    },
  };
}
