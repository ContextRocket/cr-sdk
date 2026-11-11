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
interrupted states, retry, keyboard focus management, and the same `handle` /
`api-key` browser contract as the React ChatFab. Unknown event/content types
fail closed to an accessible retry message.

The empty conversation can show opening suggestions. A site may supply them with
`data-contextrocket-suggestions` (a JSON array of strings); otherwise the widget
discovers `skills[].examples` from the public handle-specific A2A AgentCard.
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

The widget source, tests, build, versioning, and release workflow are owned by
this SDK repository. Build it locally as part of the starter; do not add a
second widget implementation to a customer fork. The starter demonstrates the
installation snippet and can copy a local bundle for demos.

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
  data-contextrocket-api-key="publishable-api-key"
  data-contextrocket-background="#FAF9F6"
  data-contextrocket-foreground="#0E0F13"
  data-contextrocket-surface="#FFFFFF"
  data-contextrocket-muted="#5E616B"
  data-contextrocket-border="#E3E0D9"
  data-contextrocket-accent="#0E0F13"
  data-contextrocket-suggestions='["What can you help me find?","Show an evidence card"]'
  data-contextrocket-position="bottom-right"
  data-contextrocket-fullscreen="true"
  data-contextrocket-fullscreen-on-open="false"
  data-contextrocket-fullscreen-on-load="false"
  data-contextrocket-locale="auto"
  defer
></script>
```

The widget has not yet been published at a ContextRocket CDN URL. Copy the
generated IIFE into the consuming site's `public/embed/widget.js` for now. The
operator release convention is to publish each package version under a unique
prefix; version `0.1.0` maps to
`https://contextrocket.cdn.contextrocket.com/embeds/chat/v0.1.0/widget.js`.
The publishing backend does not prevent overwriting a prefix, so never reuse a
published version path.

Build and copy the browser artifact into the starter public directory:

```bash
pnpm run build:widget
# -> public/embed/widget.js
```

The package is designed to be standalone, but has not yet been published to
npm. After release, Astro sites can load the built IIFE from their public
folder or a versioned CDN URL. The widget source and reusable embed
capabilities stay in `cr-sdk` packages.

The URL above is a release convention, not a claim that the artifact is live.
Operators can publish the built `dist/` directory with the ContextRocket
`sites publish` CLI; see the SDK repository README for the dry-run command.
Customers only load the public URL. The widget uses a single site-defined
palette. Set bounded CSS color values for the background, foreground, surface,
muted text, border, and accent; title, greeting, position, and locale are also
configurable.
