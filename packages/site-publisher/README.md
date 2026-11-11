# `@contextrocket/site-publisher`

Node.js and TypeScript tools for publishing a built static site to an
organization's ContextRocket CDN.

This package uses a **private, admin-scoped org machine token** to upload the
build to the existing ContextRocket site-publish API. It is a Node-only package
and must never be bundled into browser code. Browser chat continues to use a
publishable origin-bound website API key; the two credentials have different
trust levels and purposes.

## CLI

Install it in a website repository:

```bash
npm install --save-dev @contextrocket/site-publisher
```

Set `CR_API_TOKEN` in the environment, then publish the built static tree:

```bash
npx contextrocket-site-publish ./dist --org your-handle
npx contextrocket-site-publish ./dist --org contextrocket --prefix blog
```

In the starter, `--org` can be omitted: the command resolves the handle from
`CR_ORG_HANDLE`, `PUBLIC_CONTEXTROCKET_HANDLE`, or
`config/site.json` → `contextrocket.handle`, in that order. An explicit
`--org` always wins. The handle selects the target organization; it is not an
authorization credential.

For an operator dotenv file or a local API, set the target explicitly:

```bash
npx contextrocket-site-publish ./dist \
  --org contextrocket \
  --prefix blog \
  --env-file ../cr-vault/.env.prod

npx contextrocket-site-publish ./dist \
  --org your-local-org \
  --api-base http://localhost:8000 \
  --env-file ../cr-vault/.env
```

The environment file should define `CR_API_TOKEN`; `CR_API_BASE` can also set
the API target. An explicit `--api-base` takes precedence. The publisher does
not print or write the token to the generated site. It uploads a deterministic
tar.gz, queues the existing org-scoped site release, and polls its status until
the release is live by default.

Options:

- `--prefix <path>` publishes to a path under the org CDN root; omit it for the root.
- `--exclude <glob>` excludes a relative path or basename; repeat as needed.
- `--timeout <seconds>` sets the upload and status wait limit (default: 600).
- `--dry-run` packages locally and reports file/archive sizes without a token or upload.
- `--no-wait` returns the queued release ID, public URL, and status URL.
- `--help` prints the full usage.

The current API requires an organization machine token with admin scope. An
org owner can mint one with the ContextRocket credential tooling. Use a
dedicated token for publishing and rotate or revoke it when no longer needed.
Do not use the publishable browser website API key for this command, and never
put an org machine token in a `PUBLIC_*` variable, frontend source, static file,
or chat embed. A narrower site-publish credential and a Node/TypeScript
customer issuance flow are product follow-ups; until then, mint the private
credential through the authenticated ContextRocket product tooling and pass
it to Node as `CR_API_TOKEN`.

## TypeScript API

```ts
import { publishStaticSite } from "@contextrocket/site-publisher";

const receipt = await publishStaticSite({
  sourcePath: "./dist",
  orgHandle: "your-handle",
  pathPrefix: "blog",
  token: process.env.CR_API_TOKEN!,
  apiBase: process.env.CR_API_BASE,
});

console.log(receipt.publicUrl);
```

The API accepts an injected `fetcher` for deterministic tests and supports
`noWait`, `timeoutMs`, `pollIntervalMs`, `exclude`, and status callbacks. Keep
calls to this package in Node.js scripts; it is not part of `@contextrocket/sdk`
browser exports.

## Development

```bash
pnpm install
pnpm --filter @contextrocket/site-publisher run verify
npm pack --dry-run
```

The GitHub repository is public. This npm package is not published yet; its
first public release should be scheduled after its tarball and trusted
publisher configuration are verified.
