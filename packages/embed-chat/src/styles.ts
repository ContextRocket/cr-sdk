/**
 * Embed widget chrome -- Tailwind default theme scale (shadow DOM).
 *
 * Values map 1:1 to Tailwind utilities used in Tailwind UI Marketing
 * (marketing-v4 flyouts/forms) and the Next ChatFab:
 *   text-sm/6, px-3.5, py-2, gap-2, gap-3, p-4, rounded-md/xl/2xl/3xl,
 *   shadow-lg, outline-gray-900/5, size-14 launcher, bottom-6/right-6.
 */
export function widgetStyles(accentColor = "#0e0f13"): string {
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
  --cr-focus: var(--cr-theme-foreground, #0E0F13);
  --cr-accent-soft: color-mix(in srgb, var(--cr-accent) 9%, var(--cr-theme-background, #FAF9F6));
  --cr-border: color-mix(in srgb, var(--cr-theme-border, #E3E0D9) 65%, transparent);
  --cr-border-strong: var(--cr-theme-border, #E3E0D9);
  --cr-muted: var(--cr-theme-muted, #5E616B);
  --cr-bg: var(--cr-theme-background, #FAF9F6);
  --cr-card: var(--cr-theme-surface, #FFFFFF);
  --cr-text: var(--cr-theme-foreground, #0E0F13);
  --cr-secondary: color-mix(in srgb, var(--cr-theme-muted, #F4F2ED) 38%, var(--cr-theme-background, #FAF9F6));
  --cr-secondary-fg: var(--cr-theme-foreground, #0E0F13);

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
  /* The hidden panel's layout box must not block the page behind the widget. */
  pointer-events: none;
}

.cr-root[data-position="bottom-left"] {
  right: auto;
  left: var(--tw-space-6);
  align-items: flex-start;
}

@media (max-width: 30rem) {
  .cr-root {
    right: max(0.5rem, env(safe-area-inset-right, 0px));
    bottom: calc(max(0.5rem, env(safe-area-inset-bottom, 0px)) + var(--cr-fab-lift, 0px));
  }

  .cr-root .cr-panel {
    width: min(28rem, calc(100vw - 2rem));
    height: min(37.5rem, calc(100dvh - 2rem));
  }

  .cr-root[data-position="bottom-left"] {
    right: auto;
    left: max(1rem, env(safe-area-inset-left, 0px));
  }

  .cr-root .cr-launcher {
    width: 2.75rem;
    height: 2.75rem;
  }
}

.cr-root[data-fullscreen="true"] .cr-launcher {
  display: none;
}

.cr-panel[data-open="true"] ~ .cr-launcher {
  display: none;
}

/* size-14 rounded-full */
.cr-launcher {
  width: 3.5rem;
  height: 3.5rem;
  border: none;
  border-radius: 9999px;
  background: #0e0f13;
  color: #ecedf1;
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
  pointer-events: auto;
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

.cr-launcher img {
  width: 1.75rem;
  height: 1.75rem;
  display: block;
  object-fit: contain;
}

.cr-launcher [hidden] {
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
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: none;
  outline: 1px solid var(--cr-border);
  outline-offset: -1px;
  border-radius: var(--tw-radius-2xl);
  background: var(--cr-bg);
  color: var(--cr-text);
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
  transform: translateY(0.75rem) scale(0.985);
  transform-origin: bottom right;
  transition: opacity 180ms ease, transform 220ms cubic-bezier(.2,.8,.2,1), visibility 220ms;
  box-shadow: var(--cr-panel-shadow);
}

.cr-panel[data-open="true"] {
  opacity: 1;
  visibility: visible;
  pointer-events: auto;
  transform: translateY(0) scale(1);
}

.cr-panel[data-fullscreen="true"] {
  position: fixed;
  inset: 0;
  width: 100vw;
  height: 100vh;
  height: 100dvh;
  max-height: none;
  border-radius: 0;
  outline: none;
  transform: none;
  transform-origin: center;
}

.cr-root[data-position="bottom-left"] .cr-panel { transform-origin: bottom left; }

.cr-probe {
  display: inline-grid;
  place-items: center;
  position: relative;
  width: 1.5rem;
  height: 1.5rem;
  margin: 0 0.375rem 0 0;
  vertical-align: middle;
  color: var(--cr-text);
}
.cr-probe svg { position: relative; z-index: 1; width: 100%; height: 100%; overflow: visible; }
.cr-probe[data-working="true"]::before {
  content: "";
  position: absolute;
  inset: -0.2rem;
  border: 1px solid color-mix(in srgb, var(--cr-accent) 38%, transparent);
  border-radius: 9999px;
  animation: cr-probe-pulse 1.8s ease-out infinite;
  pointer-events: none;
}
@keyframes cr-probe-pulse {
  0% { transform: scale(.78); opacity: .65; }
  100% { transform: scale(1.38); opacity: 0; }
}
.cr-probe-large { width: 4rem; height: 4rem; margin: 0 0 1rem; padding: .65rem; border-radius: 9999px; background: #0e0f13; color: #ecedf1; }
.cr-empty { display: flex; flex: 1; min-height: 12rem; flex-direction: column; align-items: center; justify-content: safe center; padding: 2rem; text-align: center; }
.cr-empty[data-suggestions-view="cards"] { justify-content: flex-start; padding: .75rem 1rem; }
.cr-empty[data-suggestions-view="cards"] .cr-probe-large { width: 2.5rem; height: 2.5rem; margin-bottom: .5rem; padding: .375rem; }
.cr-empty[data-suggestions-view="cards"] p { display: none; }
.cr-empty[data-suggestions-view="cards"] .cr-suggestion-tabs { flex-wrap: nowrap; gap: .375rem; }
.cr-empty[data-suggestions-view="cards"] .cr-suggestion-tab { min-width: 0; flex: 1; padding: .375rem .5rem; font-size: .6875rem; white-space: nowrap; }
.cr-empty h3 { margin: 0; color: var(--cr-text); font-size: 1rem; font-weight: 650; letter-spacing: -.02em; }
.cr-empty p { max-width: 18rem; margin: .4rem 0 0; color: var(--cr-muted); font-size: .875rem; line-height: 1.5; }
.cr-probe path, .cr-probe-foot { fill: currentColor; }
.cr-probe-visor { fill: #0e0f13; }
.cr-probe-eye { fill: #ff2b67; transform-origin: center; }
.cr-probe[data-working="true"] .cr-probe-eye { animation: cr-scan 1.4s ease-in-out infinite alternate; }
@keyframes cr-scan { from { transform: translateX(-6px); opacity: .45; } to { transform: translateX(5px); opacity: 1; } }
.cr-agent-response { display: grid; gap: .5rem; margin-top: .75rem; }
.cr-agent-card { display: grid; gap: .35rem; padding: .75rem; border: 1px solid var(--cr-border-strong); border-radius: .75rem; background: var(--cr-bg); font-size: .8125rem; }
.cr-agent-card > strong { color: var(--cr-accent); }
.cr-agent-card p { margin: 0; color: var(--cr-muted); }
.cr-agent-evidence { padding-top: .4rem; border-top: 1px solid var(--cr-border); }
.cr-agent-evidence p { margin-top: .2rem; }
.cr-unavailable { margin-top: .5rem !important; color: var(--cr-muted); font-size: .8rem; }

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

.cr-header-actions {
  display: flex;
  align-items: center;
  gap: var(--tw-space-1);
  flex-shrink: 0;
}

.cr-fullscreen-toggle {
  display: grid;
  place-items: center;
  width: 2.75rem;
  height: 2.75rem;
  border: 0;
  border-radius: var(--tw-radius-md);
  background: transparent;
  color: var(--cr-muted);
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;
}

.cr-fullscreen-toggle:hover {
  background: var(--cr-card);
  color: var(--cr-text);
}

.cr-fullscreen-toggle:focus-visible,
.cr-close:focus-visible {
  outline: 2px solid var(--cr-focus);
  outline-offset: 2px;
}

/* text-sm/6 font-semibold */
.cr-title {
  display: flex;
  align-items: center;
  gap: 0.625rem;
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

.cr-panel[data-fullscreen="true"] .cr-header {
  min-height: 3.5rem;
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

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: .01ms !important; animation-iteration-count: 1 !important; scroll-behavior: auto !important; transition-duration: .01ms !important; }
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

.cr-status:not([hidden])::before {
  content: "";
  display: inline-block;
  width: .375rem;
  height: .375rem;
  margin: 0 .5rem .05rem 0;
  border-radius: 9999px;
  background: var(--cr-accent);
  animation: cr-status-pulse 1.4s ease-in-out infinite;
}

@keyframes cr-status-pulse {
  50% { opacity: .4; transform: scale(.82); }
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

.cr-opening-suggestions {
  display: grid;
  gap: var(--tw-space-2);
  margin: var(--tw-space-3) var(--tw-space-4) 0;
}

.cr-suggestion-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: var(--tw-space-2);
}

.cr-suggestion-tab {
  min-height: 2.25rem;
  border: 1px solid var(--cr-border-strong);
  border-radius: 9999px;
  background: var(--cr-bg);
  color: var(--cr-muted);
  padding: var(--tw-space-1_5) var(--tw-space-3);
  font: inherit;
  font-size: var(--tw-text-xs);
  cursor: pointer;
}

.cr-suggestion-tab[aria-pressed="true"] {
  border-color: var(--cr-text);
  background: var(--cr-text);
  color: var(--cr-bg);
}

.cr-suggestion-tab:focus-visible,
.cr-suggestion:focus-visible {
  outline: 2px solid var(--cr-focus);
  outline-offset: 2px;
}

.cr-suggestion-items {
  display: flex;
  flex-wrap: wrap;
  gap: var(--tw-space-2);
}

.cr-suggestion-items[data-view="cards"] {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  align-items: stretch;
}

.cr-suggestion-items[data-view="cards"] .cr-suggestion {
  min-width: 0;
  min-height: 2.25rem;
  border-radius: var(--tw-radius-lg);
  background: var(--cr-card);
  padding: var(--tw-space-1) var(--tw-space-2);
  text-align: left;
  white-space: normal;
  font-size: .6875rem;
  line-height: 1rem;
}

.cr-suggestion-items[data-view="cards"] .cr-suggestion:first-child {
  grid-column: 1 / -1;
  text-align: center;
}

.cr-suggestion-items[data-view="cards"] .cr-suggestion:last-child:nth-child(2n) {
  grid-column: 1 / -1;
  text-align: center;
}

@media (max-width: 30rem) {
  /* The centered empty state otherwise shrink-wraps this group on narrow phones. */
  .cr-empty {
    padding: 1.25rem;
  }

  .cr-empty .cr-probe-large {
    width: 3rem;
    height: 3rem;
    margin-bottom: 0.5rem;
    padding: 0.5rem;
  }

  .cr-empty .cr-opening-suggestions {
    width: 100%;
  }

  .cr-empty .cr-suggestion-tabs,
  .cr-empty .cr-suggestion-items {
    justify-content: center;
  }

  .cr-empty .cr-suggestion-tab {
    padding: var(--tw-space-1_5) var(--tw-space-2);
    font-size: var(--tw-text-xs);
  }

  .cr-empty .cr-suggestion-items[data-view="cards"] {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
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
  flex-direction: row;
  align-items: center;
  gap: var(--tw-space-3);
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
  width: auto;
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
  outline: 2px solid var(--cr-focus);
  outline-offset: 2px;
}

.cr-input::placeholder {
  color: var(--cr-muted); /* placeholder:text-gray-400-ish */
}

/* size-11 rounded-full send — matches ChatFab */
.cr-send {
  align-self: center;
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

.cr-send:focus-visible {
  outline: 2px solid var(--cr-focus);
  outline-offset: 3px;
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
  flex-direction: column;
  min-height: 2.75rem;
  align-items: center;
  justify-content: center;
  gap: 0.3rem;
  color: var(--cr-muted);
  text-decoration: none;
  opacity: 0.85;
  transition: opacity 0.2s ease, color 0.2s ease;
}

.powered-by-badge .powered-by-label {
  color: var(--cr-muted);
  font-size: 0.5rem;
  font-weight: 600;
  letter-spacing: 0.18em;
  line-height: 1;
  text-transform: uppercase;
}

.powered-by-badge .powered-by-logo {
  display: block;
  width: auto;
  height: 1.25rem;
}

.powered-by-badge:hover,
.powered-by-badge:focus-visible {
  color: var(--cr-text);
  opacity: 1;
}
`.trim();
}
