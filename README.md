# ContextRocket SDK (`cr-sdk`)

Public browser SDK and embeddable widgets for ContextRocket.

Agent-oriented rules and day-to-day commands live in [AGENTS.md](./AGENTS.md).

## Packages

| Package | Name | Role |
| --- | --- | --- |
| `packages/sdk` | `@contextrocket/sdk` | A2A wire client + `createCRClient`, typed JSON Render responses, contact forms, credentials, and config |
| `packages/embed-chat` | `@contextrocket/embed-chat` | Standalone chat widget IIFE (`dist/widget.js`) |
| `packages/site-publisher` | `@contextrocket/site-publisher` | Node-only static CDN publishing API + TypeScript CLI |

Future widgets land as `packages/embed-<name>` siblings.
The site publisher is a Node-only capability: it uses a private, admin-scoped
organization machine token and is not exported from the browser SDK.

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

Each publishable package runs its build automatically when packed. `pnpm pack`
also rewrites workspace protocol dependencies in the archive, so use it to
inspect the exact package that the release workflow publishes:

```bash
cd packages/sdk && pnpm pack --out /tmp/contextrocket-sdk-%v.tgz
cd ../embed-chat && pnpm pack --out /tmp/contextrocket-embed-chat-%v.tgz
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

## npm release

The package manifests are prepared for public scoped packages: each package
sets `publishConfig.access` to `public`, includes its README and MIT license,
and publishes only its built `dist/` output. The root workspace remains
private. Before a first release, confirm the npm organization owns the
`@contextrocket` scope and that the exact package versions are still
unpublished. Build and inspect each tarball with `pnpm pack --out` from its
package directory; this also rewrites workspace protocol dependencies.

The repository already has a manual GitHub Actions release workflow at
`.github/workflows/publish-npm.yml`. Configure npm trusted publishing for each
package using the `ContextRocket/cr-sdk` repository and that exact workflow
path. The workflow runs on `main`, verifies the workspace, and publishes only
the selected package from a GitHub-hosted runner with `id-token: write`. It
creates a pnpm tarball before asking npm to publish it, so workspace protocol
dependencies are rewritten in the archive. The chat widget uses the SDK while
building its standalone IIFE, but the published widget has no runtime package
dependency; packages can be released independently. This avoids a long-lived
npm token and provides npm provenance. The first trusted publish validates
npm's publisher configuration; complete it within two days of creating that
configuration. See
[npm's trusted publishing guide](https://docs.npmjs.com/trusted-publishers/).

Before dispatching a release, review the package tarball and confirm its exact
version is not already in the registry:

```bash
cd packages/sdk && pnpm pack --out /tmp/contextrocket-sdk-%v.tgz
npm view @contextrocket/sdk@0.1.0 version
```

Use the GitHub Actions **Publish npm package** workflow on `main` and select
`sdk`, `embed-chat`, or `site-publisher`. After it succeeds, check the exact
published version with `npm view`. Do not add an npm token to the repository,
a `PUBLIC_*` variable, or a customer site. The packages remain unpublished
until a first release is deliberately scheduled.

## Static site publishing from Node.js

Install `@contextrocket/site-publisher` in a site repository to publish a
static build without Python or a GitHub Actions dependency:

```bash
npm install --save-dev @contextrocket/site-publisher
npx contextrocket-site-publish ./dist --org your-handle --prefix blog
```

In `cr-starter`, the CLI can resolve the organization handle from
`CR_ORG_HANDLE`, `PUBLIC_CONTEXTROCKET_HANDLE`, or `config/site.json` →
`contextrocket.handle`, so `--org` is optional. The handle selects the
organization; authorization comes from the private credential.

The command reads `CR_API_TOKEN` from the environment. Use `--env-file
../cr-vault/.env.prod` for an operator environment file, or use `--api-base
http://localhost:8000` with a local development token. The token currently
must be a private admin-scoped machine credential for the target organization. It is
never written into the built site or printed. `--dry-run` packages and reports
the archive without requiring a token; `--no-wait` prints the queued release
status URL. Publishing remains an API operation; the CLI only packages the
static directory and calls the existing org-scoped publish/status endpoints.

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
published prefix. The publishing backend does not enforce version immutability:
publishing to the same prefix activates a new release at that public path. The
current CDN gives files outside `/_next/static/` a five-minute public cache;
only `/_next/static/` assets receive a one-year immutable cache. Treat versioned
embed URLs as stable by release discipline, not as an immutable storage
guarantee. The published `@contextrocket/embed-chat` version `0.1.3` is
available at:

```text
https://contextrocket.cdn.contextrocket.com/embeds/chat/v0.1.3/widget.js
```

The published contact-form browser bridge version `0.1.1` is available at:

```text
https://contextrocket.cdn.contextrocket.com/embeds/contact-form/v0.1.1/contact-form.browser.js
```

A site can pin these URLs with `PUBLIC_CONTEXTROCKET_CHAT_WIDGET_URL` and
`PUBLIC_CONTEXTROCKET_CONTACT_FORM_SCRIPT_URL`; keep the checked-in local
artifacts available for offline demos and standalone builds.

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
  ../../cr-sdk/scratchpad/cdn/embeds/chat/v0.1.3 \
  --org contextrocket \
  --prefix embeds/chat/v0.1.3 \
  --dry-run

uv run --env-file ../../cr-vault/.env.prod contextrocket sites publish \
  ../../cr-sdk/scratchpad/cdn/embeds/contact-form/v0.1.1 \
  --org contextrocket \
  --prefix embeds/contact-form/v0.1.1 \
  --dry-run
```

For a new release, review both dry runs and confirm the versioned paths have
not been released before publishing. Repeat the relevant command without
`--dry-run` to upload. This is an operator task; customer sites only load the
public URL and do not need an operator token. After publishing, run
`pnpm verify:cdn` from the SDK checkout. It checks status, JavaScript content
type, byte count, and SHA-256 against the local package builds. Do not publish
a mutable `/latest` path. The `v0.1.3` chat URL was published and verified on
2026-11-11; the `v0.1.1` contact-form URL was published and verified on
2026-11-12. An immediate CDN request can briefly return a cached 403 while a
new object propagates; verify the URL again after publication.

`v0.1.2` remains published. A fresh local build differed byte-for-byte from
that artifact, so the reproducible source build was released under `v0.1.3`
instead of overwriting the existing prefix.

## License

MIT
