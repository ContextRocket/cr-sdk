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

The GitHub repository is public, but the packages have not been published to
the npm registry yet. A standalone starter build does not need this checkout:
it uses checked-in browser artifacts under `public/embed/`. The optional
starter `pnpm run build:embeds` command refreshes those artifacts from this
repository.

For package development, build from this repository:

```bash
pnpm install
pnpm build
```

For a local application prototype that imports the TypeScript SDK, use local
package links while both repositories are checked out:

```json
"@contextrocket/sdk": "file:../cr-sdk/packages/sdk",
"@contextrocket/embed-chat": "file:../cr-sdk/packages/embed-chat"
```

Build the SDK packages first, then install the local links in the prototype.
These paths are for local development; they are not a published customer
installation method. Once the npm release is available, consumers can install
the versioned packages from the registry. Import the SDK:

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
