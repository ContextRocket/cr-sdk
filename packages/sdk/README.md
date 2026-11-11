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
NEXT_PUBLIC_CONTEXTROCKET_API_KEY=your-publishable-api-key
```

The website API key is meant for browser use and must be publishable and
origin-bound. Never put a server secret in a public variable.

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
PUBLIC_CONTEXTROCKET_API_KEY=your-publishable-api-key
```

```ts
const client = createCRClient(
  resolveCRConfig({
    agentUrl: import.meta.env.PUBLIC_CR_AGENT_URL,
    handle: import.meta.env.PUBLIC_CONTEXTROCKET_HANDLE,
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

## Development

From the repository root, `pnpm run verify` builds both packages, checks their
TypeScript, and runs the shared package test suites. Site-specific repositories
should validate their own routes, content, and static output without copying or
re-running these SDK tests.

## License

MIT
