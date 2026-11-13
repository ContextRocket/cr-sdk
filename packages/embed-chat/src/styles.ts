/**
 * Embed widget chrome -- Tailwind default theme scale (shadow DOM).
 *
 * Values map 1:1 to Tailwind utilities used in Tailwind UI Marketing
 * (marketing-v4 flyouts/forms) and the Next ChatFab:
 *   text-sm/6, px-3.5, py-2, gap-2, gap-3, p-4, rounded-md/xl/2xl/3xl,
 *   shadow-lg, outline-gray-900/5, square 56px launcher, bottom-6/right-6.
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
  --cr-launcher-bg: #FF2B67;
  --cr-launcher-fg: #FFFFFF;
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
  --cr-fab-shadow: 0 10px 28px -10px rgba(14,15,19,.55);
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
    width: 3rem;
    height: 3rem;
    border-radius: 0.875rem;
  }
}

.cr-root[data-fullscreen="true"] .cr-launcher {
  display: none;
}

.cr-panel[data-open="true"] ~ .cr-launcher {
  display: none;
}

/* 56px rounded-square Rocket launcher */
.cr-launcher {
  width: 3.5rem;
  height: 3.5rem;
  border: none;
  border-radius: 1rem;
  background: var(--cr-launcher-bg);
  color: var(--cr-launcher-fg);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  appearance: none;
  -webkit-appearance: none;
  outline: none;
  box-shadow: var(--cr-fab-shadow);
  transition: transform 0.18s ease, box-shadow 0.18s ease;
  pointer-events: auto;
}

.cr-launcher:hover {
  transform: translateY(-2px);
  box-shadow: 0 14px 32px -10px rgba(14,15,19,.6);
}

.cr-root[data-launcher-appearance="portrait"] .cr-launcher {
  width: 4rem; height: 4rem; overflow: hidden; isolation: isolate;
  border: 2px solid rgba(255,255,255,.96); border-radius: 50%;
  background: var(--cr-launcher-avatar-bg, linear-gradient(145deg, #fff 4%, #e6e5f3 48%, #8b8fb8 100%));
  box-shadow: 0 8px 26px -8px rgba(49,48,78,.42), 0 0 0 1px rgba(108,115,168,.16);
}
@media (max-width: 30rem) {
  .cr-root[data-launcher-appearance="portrait"] .cr-launcher { width: 3rem; height: 3rem; }
}
.cr-root[data-launcher-appearance="portrait"] .cr-launcher:hover {
  box-shadow: 0 12px 30px -8px rgba(49,48,78,.5), 0 0 0 3px rgba(108,115,168,.18);
}
.cr-root[data-launcher-appearance="portrait"] .cr-launcher .cr-launcher-avatar {
  width: 100%; height: 100%; border: 0; border-radius: inherit;
  object-fit: contain; object-position: center bottom; box-shadow: none;
}
.cr-root[data-launcher-appearance="portrait"] .cr-launcher::after {
  content: ""; position: absolute; z-index: 2; inset: -20%;
  background: linear-gradient(110deg, transparent 38%, rgba(255,255,255,.58) 50%, transparent 62%);
  transform: translateX(-120%); pointer-events: none;
  animation: cr-launcher-sheen 8s ease-in-out infinite;
}
.cr-root[data-launcher-appearance="portrait"] .cr-launcher .cr-launcher-avatar { position: relative; z-index: 1; }
@keyframes cr-launcher-sheen {
  0%, 74%, 100% { transform: translateX(-120%); opacity: 0; }
  78% { opacity: .8; }
  88% { transform: translateX(120%); opacity: 0; }
}

.cr-launcher:focus-visible {
  outline: 2px solid var(--cr-focus);
  outline-offset: 3px;
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

.cr-launcher .cr-launcher-avatar {
  width: calc(100% - .5rem);
  height: calc(100% - .5rem);
  border: 2px solid rgba(255,255,255,.96);
  border-radius: 9999px;
  object-fit: cover;
  box-shadow: 0 2px 8px rgba(14,15,19,.24);
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
.cr-probe .cr-agent-avatar { position: relative; z-index: 1; display: block; width: 100%; height: 100%; object-fit: cover; border-radius: inherit; }
.cr-probe[data-identity="contextrocket"] { border-radius: 9999px; background: #0e0f13; color: #fff; }
.cr-probe .cr-agent-mark { position: relative; z-index: 1; display: block; width: 68%; height: 68%; object-fit: contain; }
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
.cr-root[data-header-logo="true"] .cr-header {
  min-height: 4rem;
  background: var(--cr-header-bg, var(--cr-bg));
  color: var(--cr-header-fg, var(--cr-text));
  border-bottom-color: color-mix(in srgb, var(--cr-header-fg, var(--cr-text)) 14%, transparent);
}
.cr-title-brand-logo { display: block; width: auto; height: auto; max-width: 8rem; max-height: 2.5rem; object-fit: contain; }
.cr-root[data-header-logo="true"] .cr-close,
.cr-root[data-header-logo="true"] .cr-fullscreen-toggle { color: var(--cr-header-fg, var(--cr-text)); }
.cr-root[data-header-logo="true"] .cr-close:hover,
.cr-root[data-header-logo="true"] .cr-fullscreen-toggle:hover { background: color-mix(in srgb, var(--cr-header-fg, var(--cr-text)) 10%, transparent); color: var(--cr-header-fg, var(--cr-text)); }
.cr-root[data-header-logo="true"] .cr-close:focus-visible,
.cr-root[data-header-logo="true"] .cr-fullscreen-toggle:focus-visible { outline-color: var(--cr-header-fg, var(--cr-text)); }

.cr-title-copy { display: grid; min-width: 0; }
.cr-title-heading { display: flex; align-items: center; gap: .4rem; min-width: 0; }
.cr-title-subtitle { margin-top: .05rem; color: var(--cr-muted); font-size: .6875rem; font-weight: 500; line-height: 1.1rem; }
.cr-title-subtitle[hidden], .cr-title-badge[hidden] { display: none; }
.cr-title-badge { display: inline-flex; align-items: center; padding: .05rem .35rem; border-radius: .35rem; font-size: .68em; font-weight: 750; line-height: 1.2; }
.cr-root[data-agent-avatar-style="cutout"] .cr-panel { overflow: hidden; border-radius: 1.5rem; }
.cr-root[data-agent-avatar-style="cutout"] .cr-header {
  position: relative; z-index: 2; min-height: 5.75rem; padding: .75rem 1rem .75rem 7rem;
  overflow: visible; border: 0; border-radius: 1.5rem 1.5rem 0 0; color: #fff;
  background: linear-gradient(100deg, var(--cr-agent-header-start, #fff) 0%, #a2a7cd 15%, #7c83b4 34%, var(--cr-agent-header-end, #6c73a8) 100%);
}
.cr-root[data-agent-avatar-style="cutout"] .cr-title { color: #fff; z-index: 1; font-size: 1.2rem; font-weight: 750; line-height: 1.35; letter-spacing: -.015em; }
.cr-root[data-agent-avatar-style="cutout"] .cr-title-text { text-shadow: 0 1px 2px rgba(38,43,85,.2); }
.cr-root[data-agent-avatar-style="cutout"] .cr-title-subtitle { color: rgba(255,255,255,.94); font-size: .9rem; font-weight: 550; line-height: 1.35; text-shadow: 0 1px 2px rgba(38,43,85,.18); }
.cr-root[data-agent-avatar-style="cutout"] .cr-title-badge { background: #fff; color: #252b5c; font-size: .7rem; letter-spacing: -.01em; text-shadow: none; }
.cr-root[data-agent-avatar-style="cutout"] .cr-header-actions { z-index: 2; align-self: flex-start; gap: .45rem; }
.cr-root[data-agent-avatar-style="cutout"] .cr-close {
  width: 2.75rem; height: 2.75rem; min-width: 2.75rem; min-height: 2.75rem;
  border: 1px solid rgba(255,255,255,.88); border-radius: .875rem;
  background: rgba(255,255,255,.94); color: #172554;
  box-shadow: 0 2px 8px rgba(32,35,72,.12);
}
.cr-root[data-agent-avatar-style="cutout"] .cr-close:hover { background: #fff; color: #0e1745; box-shadow: 0 4px 12px rgba(32,35,72,.2); transform: translateY(-1px); }
.cr-root[data-agent-avatar-style="cutout"] .cr-fullscreen-toggle { color: rgba(255,255,255,.82); background: rgba(255,255,255,.08); border-radius: .875rem; }
.cr-root[data-agent-avatar-style="cutout"] .cr-fullscreen-toggle:hover { background: rgba(255,255,255,.2); color: #fff; }
.cr-root[data-agent-avatar-style="cutout"] .cr-close svg { display: block; width: 1.25rem; height: 1.25rem; }
.cr-root[data-agent-avatar-style="cutout"] .cr-title-probe {
  position: absolute; left: .75rem; bottom: 0; z-index: 3;
  width: 5rem; height: 5.75rem; margin: 0; overflow: visible;
}
.cr-root[data-agent-avatar-style="cutout"] .cr-title-probe .cr-agent-avatar {
  width: 100%; height: 100%; object-fit: contain; object-position: center bottom;
  border-radius: 0; filter: drop-shadow(0 4px 6px rgba(30,31,55,.16));
}
.cr-root[data-agent-avatar-style="cutout"] .cr-title-probe[data-working="true"] .cr-agent-avatar {
  animation: cr-avatar-breathe 2.8s ease-in-out infinite;
}
.cr-root[data-agent-avatar-style="cutout"] .cr-messages {
  position: relative; z-index: 1; margin-top: -.8rem; padding-top: 1.75rem;
  border-radius: 1.5rem 1.5rem 0 0; background: var(--cr-card);
}
.cr-root[data-agent-avatar-style="cutout"] .cr-message[data-welcome="true"] {
  max-width: 100%; padding: .35rem 1rem 1rem; border-radius: 0;
  background: transparent; color: #111b50; font-size: 1.12rem; line-height: 1.55;
  letter-spacing: -.012em;
}
.cr-root[data-agent-avatar-style="cutout"] .cr-message[data-welcome="true"] strong { font-weight: 750; color: #07194c; }
@keyframes cr-avatar-breathe { 50% { transform: translateY(-2px); filter: drop-shadow(0 7px 9px rgba(30,31,55,.2)); } }
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

.cr-fullscreen-toggle [hidden] { display: none !important; }

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

/* Full-screen chat uses the viewport as a composed experience, not a stretched drawer. */
.cr-panel[data-fullscreen="true"] {
  background: var(--cr-card);
}
.cr-panel[data-fullscreen="true"] .cr-header {
  min-height: 4.25rem;
  padding: max(1rem, env(safe-area-inset-top, 0px)) clamp(1.25rem, 4vw, 4rem) 1rem;
  border-radius: 0;
}
.cr-panel[data-fullscreen="true"] .cr-messages {
  width: 100%;
  max-width: 60rem;
  margin-inline: auto;
  padding: clamp(1.5rem, 5vh, 4rem) clamp(1rem, 4vw, 3rem);
}
.cr-panel[data-fullscreen="true"] .cr-messages[data-welcome="true"] {
  justify-content: center;
  gap: clamp(1.25rem, 3vh, 2rem);
}
.cr-panel[data-fullscreen="true"] .cr-message[data-welcome="true"] {
  width: 100%;
  max-width: 48rem;
  padding: 0;
  font-size: clamp(1.5rem, 2.5vw, 2.25rem);
  line-height: 1.4;
  letter-spacing: -.02em;
}
.cr-panel[data-fullscreen="true"] .cr-opening-suggestions {
  width: 100%;
  max-width: 48rem;
  margin: .5rem auto 0;
  gap: 1rem;
}
.cr-panel[data-fullscreen="true"] .cr-suggestion-tabs { gap: .75rem; }
.cr-panel[data-fullscreen="true"] .cr-suggestion-tab {
  min-height: 3rem;
  padding: .65rem 1.15rem;
  font-size: .875rem;
}
.cr-panel[data-fullscreen="true"] .cr-suggestion-items { gap: .75rem; }
.cr-panel[data-fullscreen="true"] .cr-suggestion-items:not([data-view="cards"]) {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 18rem), 1fr));
}
.cr-panel[data-fullscreen="true"] .cr-suggestion-items[data-view="cards"] {
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 20rem), 1fr));
  gap: 1rem;
}
.cr-panel[data-fullscreen="true"] .cr-suggestion {
  min-height: 3.5rem;
  padding: .8rem 1rem;
  border-radius: 1rem;
  font-size: .9375rem;
  line-height: 1.45;
  text-align: left;
  white-space: normal;
  box-shadow: 0 1px 2px rgb(14 15 19 / .04);
}
.cr-panel[data-fullscreen="true"] .cr-composer {
  width: min(60rem, calc(100% - 2.5rem));
  margin: 0 auto .75rem;
  padding: 1rem 1.25rem;
}
.cr-panel[data-fullscreen="true"] .cr-input { min-height: 3rem; font-size: 1rem; }
.cr-panel[data-fullscreen="true"] .cr-send { width: 3.25rem; height: 3.25rem; }
.cr-panel[data-fullscreen="true"] .cr-footer {
  padding-bottom: max(.625rem, env(safe-area-inset-bottom, 0px));
}
.cr-panel[data-fullscreen="true"] .cr-empty { width: 100%; max-width: 48rem; margin-inline: auto; }

.cr-root[data-agent-avatar-style="cutout"] .cr-panel[data-fullscreen="true"] .cr-header {
  min-height: 7.5rem;
  padding: 1rem clamp(1.25rem, 4vw, 4rem) 1rem clamp(9rem, 12vw, 12rem);
}
.cr-root[data-agent-avatar-style="cutout"] .cr-panel[data-fullscreen="true"] .cr-title {
  font-size: clamp(1.35rem, 1.8vw, 1.75rem);
}
.cr-root[data-agent-avatar-style="cutout"] .cr-panel[data-fullscreen="true"] .cr-title-subtitle {
  font-size: clamp(.9rem, 1.2vw, 1.1rem);
}
.cr-root[data-agent-avatar-style="cutout"] .cr-panel[data-fullscreen="true"] .cr-title-probe {
  left: clamp(1.25rem, 4vw, 3rem);
  width: 6.25rem;
  height: 7.1rem;
}

@media (max-width: 30rem) {
  .cr-panel[data-fullscreen="true"] .cr-header { min-height: 4rem; padding-inline: .75rem; }
  .cr-panel[data-fullscreen="true"] .cr-messages { max-width: none; padding: 1.25rem; }
  .cr-panel[data-fullscreen="true"] .cr-messages[data-welcome="true"] { justify-content: center; }
  .cr-panel[data-fullscreen="true"] .cr-message[data-welcome="true"] { font-size: 1.4rem; }
  .cr-panel[data-fullscreen="true"] .cr-opening-suggestions { margin-top: 0; }
  .cr-panel[data-fullscreen="true"] .cr-suggestion-items:not([data-view="cards"]),
  .cr-panel[data-fullscreen="true"] .cr-suggestion-items[data-view="cards"] { grid-template-columns: 1fr; }
  .cr-panel[data-fullscreen="true"] .cr-composer { width: calc(100% - 1.5rem); padding: .75rem; }
  .cr-panel[data-fullscreen="true"] .cr-footer { padding-inline: .75rem; }
  .cr-root[data-agent-avatar-style="cutout"] .cr-panel[data-fullscreen="true"] .cr-header {
    min-height: 6.5rem;
    padding: .75rem .75rem .75rem 6.25rem;
  }
  .cr-root[data-agent-avatar-style="cutout"] .cr-panel[data-fullscreen="true"] .cr-title { font-size: 1.1rem; }
  .cr-root[data-agent-avatar-style="cutout"] .cr-panel[data-fullscreen="true"] .cr-title-subtitle { font-size: .78rem; }
  .cr-root[data-agent-avatar-style="cutout"] .cr-panel[data-fullscreen="true"] .cr-title-probe {
    left: .75rem; width: 4.75rem; height: 6.25rem;
  }
  .cr-root[data-agent-avatar-style="cutout"] .cr-panel[data-fullscreen="true"] .cr-close {
    width: 2.75rem; height: 2.75rem; min-width: 2.75rem; min-height: 2.75rem;
  }
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

@media (max-width: 26rem) {
  .cr-root[data-agent-avatar-style="cutout"] .cr-header { padding-left: 6.25rem; }
  .cr-root[data-agent-avatar-style="cutout"] .cr-title { font-size: 1.05rem; }
  .cr-root[data-agent-avatar-style="cutout"] .cr-title-subtitle { font-size: .78rem; }
  .cr-root[data-agent-avatar-style="cutout"] .cr-title-probe { width: 4.5rem; height: 5.8rem; }
  .cr-root[data-agent-avatar-style="cutout"] .cr-close { width: 2.5rem; height: 2.5rem; min-width: 2.5rem; min-height: 2.5rem; }
}

@media (prefers-reduced-motion: reduce) {
  .cr-launcher, .cr-root[data-agent-avatar-style="cutout"] .cr-title-probe .cr-agent-avatar { animation: none !important; }
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
.cr-suggestions-label { flex: 0 0 100%; color: var(--cr-muted); font-size: .6875rem; font-weight: 700; letter-spacing: .06em; line-height: 1rem; text-transform: uppercase; }

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
