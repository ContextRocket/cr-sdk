/**
 * Embed widget chrome -- Tailwind default theme scale (shadow DOM).
 *
 * Values map 1:1 to Tailwind utilities used in Tailwind UI Marketing
 * (marketing-v4 flyouts/forms) and the Next ChatFab:
 *   text-sm/6, px-3.5, py-2, gap-2, gap-3, p-4, rounded-md/xl/2xl/3xl,
 *   shadow-lg, outline-gray-900/5, size-14 launcher, bottom-6/right-6.
 */
export function widgetStyles(accentColor = "#ff2b67"): string {
  return `
:host {
  all: initial;
  /* font-sans */
  font-family: ui-sans-serif, system-ui, sans-serif, "Apple Color Emoji", "Segoe UI Emoji";
  /* text-base — let children use the Tailwind type scale */
  font-size: 1rem;
  line-height: 1.5rem;
  color: #111827; /* gray-900 */
  -webkit-font-smoothing: antialiased;

  --cr-accent: ${accentColor};
  --cr-accent-soft: color-mix(in srgb, var(--cr-accent) 12%, white);
  --cr-border: rgb(17 24 39 / 0.05); /* gray-900/5 — outline-gray-900/5 */
  --cr-border-strong: #e5e7eb; /* gray-200 */
  --cr-muted: #6b7280; /* gray-500 */
  --cr-bg: #ffffff;
  --cr-card: #f9fafb; /* gray-50 */
  --cr-text: #111827; /* gray-900 */
  --cr-secondary: #f3f4f6; /* gray-100 */
  --cr-secondary-fg: #111827;

  /* Tailwind spacing scale */
  --tw-space-1: 0.25rem;
  --tw-space-1_5: 0.375rem;
  --tw-space-2: 0.5rem;
  --tw-space-2_5: 0.625rem;
  --tw-space-3: 0.75rem;
  --tw-space-3_5: 0.875rem;
  --tw-space-4: 1rem;
  --tw-space-5: 1.25rem;
  --tw-space-6: 1.5rem;
  --tw-space-8: 2rem;

  /* text-xs / text-sm / text-sm/6 / text-base */
  --tw-text-xs: 0.75rem;
  --tw-leading-xs: 1rem;
  --tw-text-sm: 0.875rem;
  --tw-leading-sm: 1.25rem;
  --tw-leading-6: 1.5rem;
  --tw-text-base: 1rem;
  --tw-leading-base: 1.5rem;

  /* rounded-md / xl / 2xl / 3xl */
  --tw-radius-md: 0.375rem;
  --tw-radius-lg: 0.5rem;
  --tw-radius-xl: 0.75rem;
  --tw-radius-2xl: 1rem;
  --tw-radius-3xl: 1.5rem;

  /* shadow-lg (Tailwind UI flyout panels) */
  --cr-panel-shadow:
    0 10px 15px -3px rgb(0 0 0 / 0.1),
    0 4px 6px -4px rgb(0 0 0 / 0.1);
  /* ChatFab launcher shadow (size-14 FAB) */
  --cr-fab-shadow:
    0 4px 12px rgba(11, 11, 15, 0.15),
    0 8px 24px rgba(11, 11, 15, 0.1);
}

:host([data-theme="dark"]) {
  color: #f9fafb; /* gray-50 */
  --cr-border: rgb(255 255 255 / 0.1); /* white/10 */
  --cr-border-strong: #374151; /* gray-700 */
  --cr-muted: #9ca3af; /* gray-400 */
  --cr-bg: #1f2937; /* gray-800 — flyout dark bg */
  --cr-card: #111827; /* gray-900 */
  --cr-text: #f9fafb;
  --cr-secondary: #374151;
  --cr-secondary-fg: #f9fafb;
  --cr-accent-soft: color-mix(in srgb, var(--cr-accent) 22%, #111827);
  --cr-panel-shadow: none; /* dark:shadow-none in Tailwind UI */
}

@media (prefers-color-scheme: dark) {
  :host([data-theme="system"]) {
    color: #f9fafb;
    --cr-border: rgb(255 255 255 / 0.1);
    --cr-border-strong: #374151;
    --cr-muted: #9ca3af;
    --cr-bg: #1f2937;
    --cr-card: #111827;
    --cr-text: #f9fafb;
    --cr-secondary: #374151;
    --cr-secondary-fg: #f9fafb;
    --cr-accent-soft: color-mix(in srgb, var(--cr-accent) 22%, #111827);
    --cr-panel-shadow: none;
  }
}

*, *::before, *::after {
  box-sizing: border-box;
}

/* fixed bottom-6 right-6 + gap-4 */
.cr-root {
  position: fixed;
  right: var(--tw-space-6);
  bottom: var(--tw-space-6);
  z-index: 2147483000;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: var(--tw-space-4);
}

.cr-root[data-position="bottom-left"] {
  right: auto;
  left: var(--tw-space-6);
  align-items: flex-start;
}

/* size-14 rounded-full */
.cr-launcher {
  width: 3.5rem;
  height: 3.5rem;
  border: none;
  border-radius: 9999px;
  background: var(--cr-accent);
  color: #fff;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  appearance: none;
  -webkit-appearance: none;
  outline: none;
  box-shadow: var(--cr-fab-shadow);
  transition: transform 0.2s ease, opacity 0.2s ease;
}

.cr-launcher:hover {
  transform: scale(1.05);
  opacity: 0.9;
}

.cr-launcher:focus-visible {
  outline: 2px solid var(--cr-text);
  outline-offset: 2px;
}

/* size-6 icons */
.cr-launcher svg {
  width: 1.5rem;
  height: 1.5rem;
  display: block;
  flex-shrink: 0;
}

.cr-launcher svg[hidden] {
  display: none !important;
}

/*
 * Panel ≈ Tailwind UI flyout:
 * max-w-md overflow-hidden rounded-2xl bg-white shadow-lg outline-1 outline-gray-900/5
 * Height keeps ChatFab drawer proportion: min(600px, 100dvh - 10rem)
 */
.cr-panel {
  width: min(28rem, calc(100vw - 3rem)); /* max-w-md / px-6 gutters */
  height: min(37.5rem, calc(100dvh - 10rem));
  display: none;
  flex-direction: column;
  overflow: hidden;
  border: none;
  outline: 1px solid var(--cr-border);
  outline-offset: -1px;
  border-radius: var(--tw-radius-2xl);
  background: var(--cr-bg);
  color: var(--cr-text);
  box-shadow: var(--cr-panel-shadow);
}

.cr-panel[data-open="true"] {
  display: flex;
}

/* Header: min-h-12 px-4 py-3 border-b */
.cr-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--tw-space-2);
  min-height: 3rem;
  padding: var(--tw-space-3) var(--tw-space-4);
  border-bottom: 1px solid var(--cr-border);
  background: var(--cr-bg);
}

/* text-sm/6 font-semibold */
.cr-title {
  margin: 0;
  font-size: var(--tw-text-sm);
  line-height: var(--tw-leading-6);
  font-weight: 600;
  letter-spacing: normal;
  text-transform: none;
  color: var(--cr-text);
}

/* Rounded icon button with a 44px minimum touch target. */
.cr-close {
  border: none;
  background: transparent;
  color: var(--cr-muted);
  cursor: pointer;
  font-size: 1.125rem; /* text-lg */
  line-height: 1;
  width: 2rem;
  height: 2rem;
  min-width: 2.75rem;
  min-height: 2.75rem;
  padding: 0;
  border-radius: var(--tw-radius-md);
  display: grid;
  place-items: center;
  transition: background 0.15s ease, color 0.15s ease;
}

.cr-close:hover {
  background: var(--cr-card);
  color: var(--cr-text);
}

/* Messages: p-4 gap-3 text-sm/6 */
.cr-messages {
  flex: 1;
  overflow-y: auto;
  padding: var(--tw-space-4);
  display: flex;
  flex-direction: column;
  gap: var(--tw-space-3);
}

.cr-message {
  max-width: 85%;
  padding: var(--tw-space-2) var(--tw-space-3);
  border: none;
  white-space: pre-wrap;
  word-break: break-word;
  font-size: var(--tw-text-sm);
  line-height: var(--tw-leading-6);
}

.cr-message[data-role="user"] {
  align-self: flex-end;
  border-radius: var(--tw-radius-xl) var(--tw-radius-xl) 0 var(--tw-radius-xl);
  background: var(--cr-secondary);
  color: var(--cr-secondary-fg);
}

.cr-message[data-role="assistant"] {
  align-self: flex-start;
  border-radius: var(--tw-radius-xl) var(--tw-radius-xl) var(--tw-radius-xl) 0;
  background: var(--cr-accent-soft);
  color: var(--cr-text);
}

.cr-message p,
.cr-message ul,
.cr-message ol,
.cr-message pre {
  margin: 0 0 var(--tw-space-2);
}

.cr-message p:last-child,
.cr-message ul:last-child,
.cr-message ol:last-child,
.cr-message pre:last-child {
  margin-bottom: 0;
}

.cr-message ul,
.cr-message ol {
  padding-left: var(--tw-space-5);
}

.cr-message a,
.cr-source {
  color: var(--cr-accent);
  text-decoration: underline;
  text-underline-offset: 2px;
}

.cr-message pre {
  overflow-x: auto;
  padding: var(--tw-space-2);
  border-radius: var(--tw-radius-md);
  background: color-mix(in srgb, var(--cr-card) 72%, #000 28%);
  font-size: var(--tw-text-xs);
  line-height: var(--tw-leading-xs);
}

.cr-markdown-heading {
  font-weight: 600;
}

.cr-message[data-streaming="true"]::after {
  content: "▋";
  display: inline-block;
  margin-left: 2px;
  animation: cr-blink 1s step-end infinite;
  color: var(--cr-accent);
}

@keyframes cr-blink {
  50% { opacity: 0; }
}

.cr-error {
  margin: 0 var(--tw-space-4);
  padding: var(--tw-space-2) var(--tw-space-2_5);
  border: 1px solid #fecaca; /* red-200 */
  border-radius: var(--tw-radius-md);
  background: #fef2f2; /* red-50 */
  color: #991b1b; /* red-800 */
  font-size: var(--tw-text-xs);
  line-height: var(--tw-leading-xs);
}

.cr-status {
  margin: 0 var(--tw-space-4) var(--tw-space-2);
  color: var(--cr-muted);
  font-size: var(--tw-text-xs);
  line-height: var(--tw-leading-xs);
}

/* rounded-full border px-3 py-1.5 text-sm font-semibold */
.cr-retry {
  align-self: flex-start;
  margin: 0 var(--tw-space-4) var(--tw-space-2);
  min-height: 2.75rem;
  border: 1px solid var(--cr-border-strong);
  border-radius: 9999px;
  background: var(--cr-bg);
  color: var(--cr-accent);
  padding: var(--tw-space-1_5) var(--tw-space-3);
  cursor: pointer;
  font: inherit;
  font-size: var(--tw-text-sm);
  line-height: var(--tw-leading-sm);
  font-weight: 600;
}

.cr-sources,
.cr-suggestions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--tw-space-1_5);
  margin-top: var(--tw-space-2);
}

/* rounded-full border px-3 py-1 text-xs/sm */
.cr-source,
.cr-suggestion {
  min-height: 1.75rem;
  border: 1px solid var(--cr-border-strong);
  border-radius: 9999px;
  background: var(--cr-bg);
  padding: var(--tw-space-1) var(--tw-space-3);
  font-size: var(--tw-text-xs);
  line-height: var(--tw-leading-xs);
}

.cr-suggestion {
  color: var(--cr-text);
  cursor: pointer;
  font: inherit;
  font-size: var(--tw-text-sm);
  line-height: var(--tw-leading-sm);
  transition: background 0.15s ease, border-color 0.15s ease;
}

.cr-suggestion:hover {
  background: var(--cr-card);
}

/*
 * Composer: rounded-xl bg-gray-50 p-3 (ChatFab muted shell)
 * Input: text-sm/6 (Tailwind UI form fields use text-base sm:text-sm/6)
 */
.cr-composer {
  display: flex;
  flex-direction: column;
  gap: var(--tw-space-2);
  margin: 0 var(--tw-space-3) var(--tw-space-3);
  padding: var(--tw-space-3);
  border: none;
  border-radius: var(--tw-radius-xl);
  background: var(--cr-card);
  box-shadow: 0 1px 2px rgb(0 0 0 / 0.05); /* shadow-xs */
}

.cr-input {
  flex: 1;
  min-width: 0;
  min-height: 2.75rem;
  width: 100%;
  border: none;
  border-radius: 0;
  padding: 0;
  font: inherit;
  font-size: var(--tw-text-sm);
  line-height: var(--tw-leading-6);
  color: var(--cr-text);
  background: transparent;
}

.cr-input:focus {
  outline: none;
}

.cr-input:focus-visible {
  outline: 2px solid var(--cr-accent);
  outline-offset: 2px;
}

.cr-input::placeholder {
  color: var(--cr-muted); /* placeholder:text-gray-400-ish */
}

/* size-11 rounded-full send — matches ChatFab */
.cr-send {
  align-self: flex-end;
  width: 2.75rem;
  height: 2.75rem;
  min-height: 2.75rem;
  border: none;
  border-radius: 9999px;
  background: var(--cr-text);
  color: var(--cr-bg);
  padding: 0;
  cursor: pointer;
  font: inherit;
  font-size: 0;
  line-height: 0;
  display: grid;
  place-items: center;
  transition: opacity 0.15s ease;
}

.cr-send::before {
  content: "";
  width: 1rem; /* size-4 */
  height: 1rem;
  background: currentColor;
  mask: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'><path d='m5 12 7-7 7 7'/><path d='M12 19V5'/></svg>") center / contain no-repeat;
  -webkit-mask: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'><path d='m5 12 7-7 7 7'/><path d='M12 19V5'/></svg>") center / contain no-repeat;
}

.cr-send[data-state="stop"]::before {
  width: 0.875rem;
  height: 0.875rem;
  border-radius: 0.125rem;
  mask: none;
  -webkit-mask: none;
}

.cr-send:hover:not(:disabled) {
  opacity: 0.8;
}

.cr-send:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

/* Footer: px-4 py-2 text-xs text-gray-500 */
.cr-footer {
  padding: var(--tw-space-2) var(--tw-space-4) var(--tw-space-2_5);
  border-top: 1px solid var(--cr-border);
  text-align: center;
  font-size: var(--tw-text-xs);
  line-height: var(--tw-leading-xs);
  color: var(--cr-muted);
}

.powered-by-badge {
  display: inline-flex;
  min-height: 2.75rem;
  align-items: center;
  gap: var(--tw-space-1_5);
  color: var(--cr-muted);
  text-decoration: none;
  opacity: 0.85;
  transition: opacity 0.2s ease, color 0.2s ease;
}

.powered-by-badge img {
  display: block;
  width: 0.875rem; /* size-3.5 */
  height: 0.875rem;
}

.powered-by-badge:hover,
.powered-by-badge:focus-visible {
  color: var(--cr-accent);
  opacity: 1;
}
`.trim();
}
