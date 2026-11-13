# ContextRocket embed widget

Standalone, dependency-free browser widget for the public starter. It supports
canned demo mode (the default, including static exports) and direct browser A2A
mode. The widget never contains a server-side credential.

Live A2A responses may include the closed JSON Render v2 catalog. The widget
validates its bounded `Response`, `Evidence`, `Progress`, `Question`,
`ProposalBatch`, and `Representation` elements, then renders their text as
passive cards. It does not execute response-provided markup, URLs, or actions.

The renderer is deliberately bounded rather than a second application surface:
it supports safe Markdown, typed citations and suggestions, honest working and
interrupted states, retry, keyboard focus management, and reader-aware scrolling
that keeps following a response only while the visitor is already near the end.
It uses the same `handle` / `api-key` browser contract as the React ChatFab.
Unknown event/content types fail closed to an accessible retry message.

The empty conversation can show opening suggestions. A site may supply them with
`data-contextrocket-suggestions` (a JSON array of strings); otherwise the widget
discovers `skills[].examples` from the typed public Agent Card at
`/{company|person}/{handle}/agent-card.json`.
Discovery follows changes to the organization or API base and discards a late
response from an earlier configuration; a failed lookup can be retried when a
visitor reopens the chat. After a turn, context-sensitive follow-up suggestions
are read from the A2A response `metadata.suggestions`. Both entry prompts and
follow-ups use the same suggestions terminology in the UI.

In demo mode, the “Preview response cards” tab lets visitors inspect the full
five-component catalog or choose a focused Evidence, Progress, Question,
ProposalBatch, or Representation example. Question cards are informational in
the public embed; authorized product interactions remain in ContextRocket.

The chat may optionally expose a full-screen toggle. Set
`data-contextrocket-fullscreen="true"` to show the expand control, and add
`data-contextrocket-fullscreen-on-open="true"` when the launcher should open in
full screen. Use `data-contextrocket-fullscreen-on-load="true"` only when the
chat should open automatically as the page loads. The header close control
returns visitors to the website; Escape exits full screen to the drawer, then
closes the drawer.

The launcher defaults to the Rocket Pink rounded square (`#FF2B67`) with the
white spark rocket. Set `data-contextrocket-launcher-color="ink"` for the Ink
square, or pass a custom `#RGB` / `#RRGGBB` color. For custom colors the widget
uses a white rocket when it meets 3:1 contrast, otherwise Ink when it meets
3:1; if neither does, it falls back to the Ink square with a white rocket.
The launcher remains a square at desktop and mobile sizes; the close control
stays in the chat header.
To use a customer portrait in the launcher instead of the rocket, set
`data-contextrocket-launcher-avatar` to an HTTP(S) image URL. The portrait is
cropped into a circular inset; `data-contextrocket-agent-avatar` independently
controls the assistant portrait inside the chat.

The widget source, tests, build, versioning, and release workflow are owned by
this SDK repository. Build it locally as part of the starter; do not add a
second widget implementation to a customer fork. Its source uses the SDK's
JSON Render validator at build time, then bundles that code into the standalone
IIFE. Installing the published widget does not install `@contextrocket/sdk` as
a runtime dependency.

```html
<script
  src="/embed/widget.js"
  data-contextrocket-mode="demo"
  defer
></script>
```

For a live site, configure the API base and organization handle:

```html
<script
  src="/embed/widget.js"
  data-contextrocket-mode="live"
  data-contextrocket-api-base="https://api.contextrocket.com"
  data-contextrocket-handle="your-organization-handle"
  data-contextrocket-subject-kind="company"
  data-contextrocket-api-key="publishable-api-key"
  data-contextrocket-background="#FAF9F6"
  data-contextrocket-foreground="#0E0F13"
  data-contextrocket-surface="#FFFFFF"
  data-contextrocket-muted="#5E616B"
  data-contextrocket-border="#E3E0D9"
  data-contextrocket-accent="#0E0F13"
  data-contextrocket-launcher-color="pink"
  data-contextrocket-suggestions='["What can you help me find?","Show an evidence card"]'
  data-contextrocket-position="bottom-right"
  data-contextrocket-fullscreen="true"
  data-contextrocket-fullscreen-on-open="false"
  data-contextrocket-fullscreen-on-load="false"
  data-contextrocket-locale="auto"
  data-contextrocket-agent-avatar="/images/agent-avatar.webp"
  defer
></script>
```

Use `data-contextrocket-subject-kind="person"` for a Personal Brand. Its card
and chat requests use `/person/{handle}/agent-card.json` and
`/person/{handle}/a2a`; the default is `company`. Without a handle, the widget
uses the platform `/a2a` endpoint. The widget does not try legacy organization
routes.

The widget is published at the versioned URL
`https://contextrocket.cdn.contextrocket.com/embeds/chat/v0.0.2/widget.js`.
You can use that URL directly or copy the generated IIFE into a consuming
site's `public/embed/widget.js` for offline demos. Publish each package version
under a unique prefix.
The publishing backend activates a new release if the same prefix is published
again, so never reuse a published version path. The current CDN applies a
five-minute public cache to these paths; one-year immutable caching is reserved
for `/_next/static/` assets. Versioned widget URLs are therefore stable by
release discipline, not by a server-enforced immutability guarantee. The
version `0.0.2` is the current public release line. Versioned CDN paths are
managed by release discipline; the publishing backend can replace a path if it
is published again.

Build and copy the browser artifact into the starter public directory:

```bash
pnpm run build:widget
# -> public/embed/widget.js
```

The package is designed to be standalone, but has not yet been published to
npm. After release, Astro sites can load the built IIFE from their public
folder or a versioned CDN URL. Install it and copy the artifact into a static
site's public directory:

```bash
npm install --save-dev @contextrocket/embed-chat
cp node_modules/@contextrocket/embed-chat/dist/widget.js public/embed/widget.js
```

The widget source and reusable embed capabilities stay in `cr-sdk` packages.

Operators publish new versions of the built `dist/` directory with the
ContextRocket `sites publish` CLI; see the SDK repository README for the dry-run
command. Customers only load the public URL. The widget uses a single
site-defined palette. Set bounded CSS color values for the background,
foreground, surface, muted text, border, and accent; title, greeting, position,
and locale are also configurable. The optional `data-contextrocket-agent-avatar`
uses a site-hosted portrait inside the chat panel; the branded rocket launcher
is unchanged. In live mode, supported `en`, `es`, and `de` locales are sent as
both `Accept-Language` and the ContextRocket `metadata.scope.answer_locale`
extension so the agent can answer in the selected language.
