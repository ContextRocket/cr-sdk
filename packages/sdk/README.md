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

For a static Astro site, configure public build-time variables in `.env`:

```dotenv
PUBLIC_CR_AGENT_URL=https://api.contextrocket.com
PUBLIC_CONTEXTROCKET_HANDLE=your-organization-handle
PUBLIC_CONTEXTROCKET_API_KEY=your-publishable-api-key
```

The website API key is meant for browser use and must be publishable and
origin-bound. Never put a server secret in a public variable.

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

`streamTask` and `sendTask` are also exported for callers that need direct
control of the A2A request options. Event types are normalized from the current
ContextRocket A2A 1.0 contract.

## Submit a contact form

The `@contextrocket/sdk/contact-form` subpath exposes typed form submission
helpers. The server resolves the organization from its public handle and
validates the request origin; no browser API key is sent to this endpoint.
Today, the backend sources the organization's allowed origins from an active
website API key's `allowed_origins` setting, even for contact-only sites. The
key is not a request credential for this endpoint. Configure the exact site
origin there before enabling live forms; org-level origin settings are the
cleaner long-term seam.
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
