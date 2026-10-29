import type { WidgetConfig } from "./types";

export type WidgetLocale = "en" | "es" | "de";

/** Auto/omitted UI locale follows the host document; unsupported hosts use English. */
export function resolveWidgetLocale(
  locale: string | undefined,
  hostLanguage = typeof document === "undefined"
    ? ""
    : document.documentElement.lang,
): WidgetLocale {
  if (locale === "en" || locale === "es" || locale === "de") return locale;
  const host = hostLanguage.trim().toLowerCase().split(/[-_]/)[0];
  return host === "es" || host === "de" ? host : "en";
}

export const COPY = {
  en: {
    defaultTitle: "Ask ContextRocket",
    poweredBy: "Powered by ContextRocket",
    generic: "Something went wrong. Try again.",
    demoResponse:
      "This is a canned ContextRocket demo response. Configure live mode with an organization handle when you are ready to connect your own knowledge base.",
    open: "Open chat",
    close: "Close chat",
    send: "Send",
    stop: "Stop response",
    retry: "Try again",
    placeholder: "Ask a question…",
    working: "Working…",
    submitted: "Connecting…",
    inputRequired: "A response is needed to continue.",
    canceled: "Response stopped. You can try again.",
    interrupted:
      "The connection ended before the answer was complete. Please try again.",
    unsupported:
      "This content is not available in this chat. Please try again.",
    sources: "Sources",
    suggestions: "Suggested follow-ups",
  },
  es: {
    defaultTitle: "Pregunta a ContextRocket",
    poweredBy: "Con tecnología de ContextRocket",
    generic: "Algo salió mal. Inténtalo de nuevo.",
    demoResponse:
      "Esta es una respuesta de demostración de ContextRocket. Configura el modo en vivo con el handle de tu organización para conectar tu propio contenido.",
    open: "Abrir chat",
    close: "Cerrar chat",
    send: "Enviar",
    stop: "Detener respuesta",
    retry: "Intentar de nuevo",
    placeholder: "Haz una pregunta…",
    working: "Trabajando…",
    submitted: "Conectando…",
    inputRequired: "Se necesita una respuesta para continuar.",
    canceled: "Respuesta detenida. Puedes intentarlo de nuevo.",
    interrupted:
      "La conexión terminó antes de completar la respuesta. Inténtalo de nuevo.",
    unsupported:
      "Este contenido no está disponible en este chat. Inténtalo de nuevo.",
    sources: "Fuentes",
    suggestions: "Sugerencias",
  },
  de: {
    defaultTitle: "Frag ContextRocket",
    poweredBy: "Mit ContextRocket",
    generic: "Etwas ist schiefgelaufen. Versuch es erneut.",
    demoResponse:
      "Dies ist eine Demo-Antwort von ContextRocket. Konfiguriere den Live-Modus mit dem Handle deiner Organisation, um deine eigenen Inhalte zu verbinden.",
    open: "Chat öffnen",
    close: "Chat schließen",
    send: "Senden",
    stop: "Antwort stoppen",
    retry: "Erneut versuchen",
    placeholder: "Frage stellen…",
    working: "Wird bearbeitet…",
    submitted: "Verbindung wird hergestellt…",
    inputRequired: "Für die Fortsetzung ist eine Antwort erforderlich.",
    canceled: "Antwort gestoppt. Du kannst es erneut versuchen.",
    interrupted:
      "Die Verbindung endete vor Abschluss der Antwort. Bitte erneut versuchen.",
    unsupported:
      "Dieser Inhalt ist in diesem Chat nicht verfügbar. Bitte erneut versuchen.",
    sources: "Quellen",
    suggestions: "Vorschläge",
  },
} as const;

export type WidgetCopy = (typeof COPY)[keyof typeof COPY];

export function copyFor(config: WidgetConfig): WidgetCopy {
  return COPY[resolveWidgetLocale(config.locale)];
}
