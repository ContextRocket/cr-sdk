# ContextRocket browser SDK

`@contextrocket/sdk` provides typed browser clients for ContextRocket's A2A
agent endpoint and organization-scoped contact form submissions.

## Install status

The GitHub repository is public, but `@contextrocket/sdk` has not been
published to the npm registry yet. `pnpm add @contextrocket/sdk` will not work
until a version is released. For local package development, build this
repository and use a `file:` dependency from a sibling checkout as described in
the root [README](../../README.md). A standalone Astro starter uses the
generated browser artifact and does not require this checkout for normal builds.

After the npm release, install the package with:

```sh
pnpm add @contextrocket/sdk
```

For Next.js, `resolveCRConfig()` reads the statically referenced
`NEXT_PUBLIC_*` variables from `.env.local`. Astro/Vite keeps `PUBLIC_*`
variables on `import.meta.env` and does not expose them as `process.env`, so
pass those public values explicitly:

```dotenv
NEXT_PUBLIC_CR_AGENT_URL=https://api.contextrocket.com
NEXT_PUBLIC_CONTEXTROCKET_HANDLE=your-organization-handle
NEXT_PUBLIC_CONTEXTROCKET_SUBJECT_KIND=company
NEXT_PUBLIC_CONTEXTROCKET_API_KEY=your-publishable-api-key
```

The website API key is meant for browser use and must be publishable and
origin-bound. Never put a server secret in a public variable.

Customer integrations should set their organization's handle explicitly; the
SDK does not silently route an unconfigured client to the `contextrocket`
organization. With a handle, A2A uses the typed
`/{company|person}/{handle}/a2a` endpoint. Omitting the handle selects the
platform `/a2a` endpoint, which is useful for ContextRocket operator workflows
that intentionally address the platform agent. Static callers can also use
the typed company endpoint with `handle: "contextrocket"`.

### A2A identity and access tiers

The handle selects an organization; it does not prove that the caller is a
member. ContextRocket resolves credentials before applying its shared
capability scopes:

| A2A caller | SDK credential | Access boundary |
| --- | --- | --- |
| Published public visitor | No credential, with the public handle | Published public context only; subject to the handle's exposure and origin/rate policy |
| Website chat | `apiKey` plus `handle` | Same public-read boundary. The origin-bound key identifies an allowed website; it does not grant member or private Context Graph access |
| Signed-in organization member | `bearerToken` | Membership-scoped capabilities after the API verifies the member and organization |
| Organization machine credential | Server-side credential | Machine-scoped capabilities; never expose it to a browser |

The standalone embed supports the public visitor and website-chat paths. Use the
typed SDK with a verified signed-in session for member A2A. Do not send both a
website key and a member token to try to combine their authority. An organization
handle or credential's organization binding alone is not authorization: the API
checks authentication, membership or credential scope, origin, and current
organization policy before resolving capabilities.

Capability scopes are resolved by the server from the authenticated principal
and interface; they are not caller-supplied A2A metadata or OAuth scopes. The
organization's validated Brand Agent policy then gates each supported
capability. Agent Card skills describe the capabilities currently exposed to
that caller, but the API checks policy and authorization again when handling a
turn. Clients should treat the card as discovery, not as a grant of access. The
A2A request and event wire contract is the same for these access tiers.

`client.agentCard()` fetches the card for its configured handle from
`https://api.contextrocket.com/company/{handle}/agent-card.json` or
`/person/{handle}/agent-card.json`, according to the explicitly selected
`subjectKind` (`company` or `person`; default: `company`). Personal-brand
integrations must set `subjectKind: "person"`; the SDK never infers identity
kind from the handle. Organization turns use the matching typed endpoint
`/{company|person}/{handle}/a2a`, including when authenticated with a bearer
token. A handle-free platform call uses `/a2a`; the SDK does not fall back to
the old `/api/agent/a2a` or `/agent-card/{handle}.json` paths. The generic
`/.well-known/agent-card.json` endpoint describes the ContextRocket runtime and
does not select an organization. When an organization's verified website
origin is configured to proxy A2A, that site's own
`/.well-known/agent-card.json` returns the organization card selected from the
verified host. Agent Cards are discovery documents, not authorization grants.

Use `@contextrocket/sdk/identity-urls` when a static build needs canonical
typed MCP, A2A, agent-card, or public Grounding Page URLs without creating a
live client:

```ts
import {
  crGroundingPageUrl,
  crIdentityUrl,
} from "@contextrocket/sdk/identity-urls";

const agentCardUrl = crIdentityUrl(
  "https://api.contextrocket.com",
  "person",
  "mark-macmahon",
  "agent-card.json",
);
const groundingPageUrl = crGroundingPageUrl("person", "mark-macmahon");
```

Pass the selected identity kind explicitly. The helper encodes the handle as a
single path segment and does not construct platform-discovery URLs.
`crGroundingPageUrl` uses `https://contextrocket.com` by default and accepts a
verified customer web origin when the same typed identity path is served via
reverse proxy. Grounding Page links use the web origin; MCP, A2A, and Agent
Card URLs use the API origin.

## Stream an A2A turn

```ts
import {
  buildTextTurnParams,
  createCRClient,
  resolveCRConfig,
} from "@contextrocket/sdk";

const client = createCRClient(resolveCRConfig());
const params = buildTextTurnParams("What can you help me with?");

for await (const event of client.streamTurn(params)) {
  if (event.type === "TaskArtifactUpdateEvent") {
    for (const part of event.artifact.parts) {
      if (part.type === "text") console.log(part.text);
    }
  }
}
```

In an Astro component or client module:

```dotenv
PUBLIC_CR_AGENT_URL=https://api.contextrocket.com
PUBLIC_CONTEXTROCKET_HANDLE=your-organization-handle
PUBLIC_CONTEXTROCKET_SUBJECT_KIND=company
PUBLIC_CONTEXTROCKET_API_KEY=your-publishable-api-key
```

```ts
const client = createCRClient(
  resolveCRConfig({
    agentUrl: import.meta.env.PUBLIC_CR_AGENT_URL,
    handle: import.meta.env.PUBLIC_CONTEXTROCKET_HANDLE,
    subjectKind:
      import.meta.env.PUBLIC_CONTEXTROCKET_SUBJECT_KIND === "person"
        ? "person"
        : "company",
    apiKey: import.meta.env.PUBLIC_CONTEXTROCKET_API_KEY,
  }),
);
```

Explicit values passed to `resolveCRConfig()` override environment defaults.
Only put publishable, origin-bound website API keys in browser variables.

`streamTask` and `sendTask` are also exported for callers that need direct
control of the A2A request options. Event types are normalized from the current
ContextRocket A2A 1.0 contract. Artifact events retain text parts and validated
JSON Render v2 response cards; unsupported or malformed structured parts are
omitted. The SDK reads the standard A2A one-of `{ data, metadata }` shape and
normalizes accepted cards to `type: "data"`. Terminal `suggestions` are typed
on `A2AEventMetadata`.

```ts
import { parseAgentResponsePart } from "@contextrocket/sdk/json-render";
import type { AgentResponseSpec } from "@contextrocket/sdk/json-render";

for await (const event of client.streamTurn(params)) {
  if (event.type !== "TaskArtifactUpdateEvent") continue;
  for (const part of event.artifact.parts) {
    if (part.type === "data") {
      renderResponse(part.data.spec);
    }
  }
}

function renderResponse(spec: AgentResponseSpec) {
  // Bind these known components to the host site's own UI.
  console.log(spec.elements.response.children);
}

const validated = parseAgentResponsePart(untrustedA2ADataPart);
if (validated) renderResponse(validated);
```

`AgentUIDataPart` is the normalized response type. The validator is also
exported for callers that receive A2A data parts outside `createCRClient()`.
It accepts only the product's bounded `Response`, `Evidence`, `Progress`,
`Question`, `ProposalBatch`, and `Representation` catalog.

## Submit a contact form

The `@contextrocket/sdk/contact-form` subpath exposes typed form submission
helpers. The server resolves the organization from its public handle and
validates the request origin against the organization's contact-form website
settings; no browser API key is required or sent to this endpoint. In
ContextRocket, configure exact origins under **Settings → Organization →
General → Contact form websites**. Add each hostname visitors may use, such as
both the apex and `www` origins. Origins are managed independently of chat API
keys, so a contact-only site does not need a chat credential and rotating a
chat key does not remove contact access.
ContextRocket records these submissions as leads, so the SDK keeps that term
only in backend receipts and protocol fields.

```ts
import { createContactFormController } from "@contextrocket/sdk/contact-form";

const submission = createContactFormController();
const receipt = await submission.submit({
  apiBaseUrl: "https://api.contextrocket.com",
  orgHandle: "your-organization-handle",
  pageUrl: window.location.href,
  referrerUrl: document.referrer,
  form: {
    name: "Alex Example",
    email: "alex@example.com",
    message: "I'd like to learn more.",
    intent: "contact",
    consent: true,
  },
});
```

For native HTML forms, `mapContactFormData(new FormData(form), options)` maps
site-selected field names to the shared payload, trims common values, and only
sets `consent: true` when the configured consent control was submitted with an
affirmative value. It supports split first/last name fields and a site-provided
default intent. Keep labels, validation, custom answers, and form presentation
in the site; do not use this helper to flatten sensitive uploads into a message.

Organization-configured extra answers can be passed as typed JSON under
`custom_answers`. Keys must match active, non-system, non-computed fields in
that organization's Leads table; the API validates the key and value against
the organization's field schema. Unknown keys, absent schemas, unsupported
value shapes, and oversized answers are rejected instead of being dropped.
Map browser field names to the configured organization field keys with
`mapCustomContactAnswers`, then pass the structured values through
`customAnswers`:

```ts
import {
  mapContactFormData,
  mapCustomContactAnswers,
} from "@contextrocket/sdk/contact-form";

const form = mapContactFormData(new FormData(htmlForm), {
  fields: { name: "your-name", email: "your-email", consent: "consent" },
  defaultIntent: "contact",
  customAnswers: mapCustomContactAnswers(new FormData(htmlForm), {
    residence_type: { name: "residence-type" },
    monthly_income: { name: "monthly-income", type: "number" },
    contact_preferences: { name: "contact-preferences", type: "multi_select" },
  }),
});
```

The helper bounds the payload to 50 answer keys, 64 characters per key, 4,096
serialized characters per answer, and 16,384 serialized characters total.
The server remains authoritative and also validates values against the org's
current field definitions. A same-key retry that changes only custom answers
replays the original stored submission; reset the controller for a new enquiry.

For interactive forms, call `submission.submit(options)` instead of the
one-shot helper. It reuses an idempotency key after a failed retry, creates a
new key when the payload changes, and shares an unchanged request while it is
in flight. Call `submission.reset()` when the user edits the form. The browser
artifact exposes the same controller on `window.ContextRocketSDK`; form layout,
validation, and status UI remain under the site's control.

Attribution omits fragments and arbitrary query parameters, and keeps only
bounded `utm_*` values. The `contact-form.browser.js` artifact is also built for
static sites that load a script rather than bundle npm modules; it is emitted
to `dist/contact-form.browser.js` by the package build.
TypeScript consumers of the static bridge can import the
`ContextRocketBrowserSDK` type from `@contextrocket/sdk`; it also makes
`window.ContextRocketSDK` available as an optional, accurately typed property
after referencing the package types.

## Site consent and browser integrations

The `@contextrocket/sdk/site-consent` subpath owns the versioned consent
preference contract, storage migration, and consent-change event. The
`@contextrocket/sdk/site-integrations` subpath owns consent-aware loading for
Google Tag Manager, Google Analytics, PostHog, and explicitly configured HTTPS
scripts. These modules do not own a site's banner copy or page styling.

Static sites can load the generated `site-behaviors.browser.js` artifact. It
binds the starter's translated banner markup and reads the integration
configuration emitted by the site. The SDK build emits this bundle alongside
`contact-form.browser.js`; `cr-starter` checks in a generated local copy for
offline builds. The site-behaviors bundle is not yet published to the CDN.

## Development

From the repository root, `pnpm run verify` builds both packages, checks their
TypeScript, and runs the shared package test suites. Site-specific repositories
should validate their own routes, content, and static output without copying or
re-running these SDK tests.

## License

MIT
