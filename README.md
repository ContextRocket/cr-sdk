# ContextRocket SDK (`cr-sdk`)

Public browser SDK and embeddable widgets for ContextRocket.

Agent-oriented rules and day-to-day commands live in [AGENTS.md](./AGENTS.md).

## Packages

| Package | Name | Role |
| --- | --- | --- |
| `packages/sdk` | `@contextrocket/sdk` | A2A wire client + `createCRClient`, credentials, config, and contact form submissions |
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

Each publishable package runs its build automatically during npm packing. Check
the exact package contents without publishing from the package directory:

```bash
cd packages/sdk && npm pack --dry-run
cd ../embed-chat && npm pack --dry-run
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
  extractContactAttribution,
  submitContactForm,
} from "@contextrocket/sdk/contact-form";
```

`extractContactAttribution(pageUrl, referrerUrl)` returns only the page origin and
path, the referrer origin, and bounded `utm_*` values. It omits other query
parameters and fragments so form URLs do not accidentally forward tokens or
personal data.

The SDK build also emits `packages/sdk/dist/contact-form.browser.js`, a
dependency-free IIFE that installs `window.ContextRocketSDK` for static sites
that cannot bundle npm modules. The starter checks in that generated file as
`public/embed/contact-form.js`; refresh it with `pnpm run build:contact-form` from
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

## CDN distribution

Use the CDN for standalone browser artifacts that a site loads with a script
tag. Keep the typed SDK on npm for sites that bundle TypeScript modules. The
ContextRocket CDN origin is `https://contextrocket.cdn.contextrocket.com`;
embed releases live under `/embeds/`, separate from the shared `/brand/` kit.

Publish each package version to a versioned prefix and never overwrite a
published prefix. The publishing backend does not enforce immutability, so this
is a release-process rule. For example, `@contextrocket/embed-chat` version
`0.1.0` should publish `dist/widget.js` to:

```text
https://contextrocket.cdn.contextrocket.com/embeds/chat/v0.1.0/widget.js
```

The contact-form bridge can use the same convention at
`/embeds/contact-form/v<version>/contact-form.browser.js`. A site can pin the
chat URL with `PUBLIC_CONTEXTROCKET_CHAT_WIDGET_URL`; keep the checked-in local
artifact available for offline demos and standalone builds.

Prepare only the standalone browser files (not the rest of the SDK package
output) after building both packages:

```bash
pnpm build
pnpm prepare:cdn
```

This stages one file per prefix under `scratchpad/cdn/embeds/`, using each
source package's version. The existing operator CLI publishes a directory
under an organization prefix. From the ContextRocket `backend/` checkout,
validate each staged artifact without uploading it:

```bash
uv run --env-file ../../cr-vault/.env.prod contextrocket sites publish \
  ../../cr-sdk/scratchpad/cdn/embeds/chat/v0.1.0 \
  --org contextrocket \
  --prefix embeds/chat/v0.1.0 \
  --dry-run

uv run --env-file ../../cr-vault/.env.prod contextrocket sites publish \
  ../../cr-sdk/scratchpad/cdn/embeds/contact-form/v0.1.0 \
  --org contextrocket \
  --prefix embeds/contact-form/v0.1.0 \
  --dry-run
```

Review both dry runs and confirm the versioned paths have not been released
before publishing. Repeat the relevant command without `--dry-run` to upload.
This is an operator task; customer sites only load the public URL and do not
need an operator token. Do not publish a mutable `/latest` path.

## License

MIT
