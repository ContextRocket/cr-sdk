# ContextRocket SDK (`cr-sdk`)

Public browser SDK and embeddable widgets for ContextRocket.

Agent-oriented rules and day-to-day commands live in [AGENTS.md](./AGENTS.md).

## Packages

| Package | Name | Role |
| --- | --- | --- |
| `packages/sdk` | `@contextrocket/sdk` | A2A wire client + `createCRClient`, credentials, config |
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
```

Copy the chat widget into a site’s public folder:

```bash
pnpm --dir ../cr-sdk/packages/embed-chat build
cp ../cr-sdk/packages/embed-chat/dist/widget.js public/embed/widget.js
```

## CDN (later)

Versioned artifacts, e.g. `https://cdn.contextrocket.com/sdk/v1/chat.js`.
Until then, serve the built IIFE from the consuming site or a relative path to
this checkout.

## License

MIT
