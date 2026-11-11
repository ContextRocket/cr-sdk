# ContextRocket SDK (`cr-sdk`) -- Agent Guide

Public browser SDK and embeddable widgets for ContextRocket. This repo is the
**only** place browser A2A clients and embed scripts are authored. Starters
and product apps consume packages from here; they must not copy SDK or widget
source in-tree.

## Layout

| Path | npm name | Role |
| --- | --- | --- |
| `packages/sdk` | `@contextrocket/sdk` | Typed browser SDK: A2A client, `createCRClient`, credentials, config |
| `packages/embed-chat` | `@contextrocket/embed-chat` | Standalone chat widget IIFE → `dist/widget.js` |

Root `package.json` is **private**. Publishable units are the packages under
`packages/`. Future widgets belong as `packages/embed-<name>` siblings.

## Hard rules

1. Do not add LLM API keys or server secrets. Browser credentials are
   publishable, origin-bound Website API keys only.
2. Consumers import `@contextrocket/sdk` (or load the embed IIFE). Do not tell
   apps to reintroduce `lib/a2a-client` or `lib/cr-sdk` shims.
3. Keep packages self-contained. No imports from sibling app repos
   (`cr-starter`, `cr-auth-starter`, `cr-luna`, etc.).
4. Prefer day-zero APIs: no deprecation shims or compatibility fallbacks unless
   a published semver contract already requires them.
5. Temporary files only under `scratchpad/` (git-ignored).

## Local development

```bash
source ~/.zshrc && nvm use --silent   # Node from .nvmrc
pnpm install
pnpm build                            # builds all packages
pnpm verify                           # build, typecheck, and test all packages
```

Node **>= 22**. Package manager: **pnpm** (see root `packageManager`).

### Consume from a sibling checkout (before npm publish)

In the consumer `package.json`:

```json
"@contextrocket/sdk": "file:../cr-sdk/packages/sdk",
"@contextrocket/embed-chat": "file:../cr-sdk/packages/embed-chat"
```

(Auth-line apps under `frontend/` use `file:../../cr-sdk/packages/...`.)

```ts
import { createCRClient, resolveCRConfig, streamTask } from "@contextrocket/sdk";
```

Refresh a site’s served widget:

```bash
pnpm --dir packages/embed-chat build
# consumer: cp ../cr-sdk/packages/embed-chat/dist/widget.js public/embed/widget.js
```

## Publishing mindset (npm / CDN)

- Root stays private; publish `@contextrocket/sdk` and `@contextrocket/embed-chat`
  (and later `embed-*`) individually or via workspace filtered publish.
- Ship only built artifacts plus package-specific README and license files
  (`files: ["dist"]`; npm includes README, license, and package metadata).
- Embed IIFE is also a CDN candidate
  (`https://cdn.contextrocket.com/sdk/v…/chat.js`); version immutably.
- The GitHub repo is public; npm publication is pending. Standalone starters
  use checked-in browser artifacts for normal builds. Use `file:` dependencies
  only for local application development with a sibling `cr-sdk` checkout.

## What belongs elsewhere

| Concern | Home |
| --- | --- |
| Branded static sites | `cr-starter` / Astro forks |
| Auth + dashboard product base | `cr-auth-starter` / `cr-luna` |
| Customer CLI | `cli/` inside starters (not this repo) |
| ContextRocket product slices | product repos — do not port here |

## Docs

- `README.md` — human overview and install snippets
- Package READMEs under `packages/*/README.md` when present
