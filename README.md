# ContextRocket SDK (`cr-sdk`)

Public browser SDK and embeddable widgets for ContextRocket.

Agent-oriented rules and day-to-day commands live in [AGENTS.md](./AGENTS.md).

## Packages

| Package | Name | Role |
| --- | --- | --- |
| `packages/sdk` | `@contextrocket/sdk` | A2A wire client + `createCRClient`, credentials, config, and lead capture |
| `packages/embed-chat` | `@contextrocket/embed-chat` | Standalone chat widget IIFE (`dist/widget.js`) |

Future widgets land as `packages/embed-<name>` siblings.

## Local development (pnpm)

From a sibling starter checkout:

```bash
cd ../cr-sdk && pnpm install && pnpm build
```

In the starter `package.json`:

```json
"@contextrocket/sdk": "file:../cr-sdk/packages/sdk",
"@contextrocket/embed-chat": "file:../cr-sdk/packages/embed-chat"
```

Then `pnpm install` in the starter. Import the SDK:

```ts
import { createCRClient, resolveCRConfig, streamTask } from "@contextrocket/sdk";
import {
  extractLeadAttribution,
  submitPublicLead,
} from "@contextrocket/sdk/lead-capture";
```

`extractLeadAttribution(pageUrl, referrerUrl)` returns only the page origin and
path, the referrer origin, and bounded `utm_*` values. It omits other query
parameters and fragments so form URLs do not accidentally forward tokens or
personal data.

The SDK build also emits `packages/sdk/dist/lead-capture.browser.js`, a
dependency-free IIFE that installs `window.ContextRocketSDK` for static sites
that cannot bundle npm modules. The starter checks in that generated file as
`public/embed/lead-capture.js`; refresh it with `pnpm run build:lead-sdk` from
the starter checkout. The npm subpath above is the typed ESM entry point; the
`.browser.js` file is only for a `<script>` tag.

From a starter or fork with a sibling `cr-sdk` checkout, build and sync the
widget in one step:

```bash
pnpm run build:widget
```

That command builds the package and runs
`node scripts/sync-embed-artifact.mjs widget`. Generated bundles belong in each
standalone site’s `public/embed/`; widget source and tests remain centralized
here.

## CDN (later)

Versioned artifacts, e.g. `https://cdn.contextrocket.com/sdk/v1/chat.js`.
Until then, serve the built IIFE from the consuming site or a relative path to
this checkout.

## License

MIT
