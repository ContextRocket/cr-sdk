import type { WidgetConfig, WidgetDemoCard } from "./types";

type DemoCardSuggestion = {
  component?: WidgetDemoCard;
  label: string;
};

export type WidgetLocale = "en" | "es" | "de" | "zh";

/** Auto/omitted UI locale follows the host document; unsupported hosts use English. */
export function resolveWidgetLocale(
  locale: string | undefined,
  hostLanguage = typeof document === "undefined"
    ? ""
    : document.documentElement.lang,
): WidgetLocale {
  if (locale === "en" || locale === "es" || locale === "de" || locale === "zh") return locale;
  const host = hostLanguage.trim().toLowerCase().split(/[-_]/)[0];
  return host === "es" || host === "de" || host === "zh" ? host : "en";
}

export const COPY = {
  en: {
    defaultTitle: "Ask ContextRocket",
    poweredBy: "Powered by ContextRocket",
    poweredByLabel: "Powered by",
    generic: "Something went wrong. Try again.",
    demoResponse:
      "This preview uses sample content to show the structured response cards this chat can render. Configure live mode to connect an organization’s agent.",
    demoProgress: "Preview only · reviewing sample sources",
    demoEvidenceTitle: "Example source",
    demoEvidenceExcerpt: "Sample evidence demonstrates how an answer can cite its source.",
    demoEvidenceTitleTwo: "A second source",
    demoEvidenceExcerptTwo: "Each card uses a typed JSON Render component.",
    demoQuestion: "Which topic would you like to explore next?",
    demoProposal: "A sample proposal shows how an idea can be summarized.",
    demoProposalTwo: "Related proposals can be grouped together.",
    demoSuggestions: ["Can you tell me more?", "What should I explore next?", "Show me an example."],
    open: "Open chat",
    close: "Close chat",
    expand: "Expand chat",
    collapse: "Exit full screen",
    send: "Send",
    stop: "Stop response",
    retry: "Try again",
    placeholder: "Ask a question…",
    working: "Thinking…",
    submitted: "Connecting…",
    inputRequired: "A response is needed to continue.",
    canceled: "Response stopped. You can try again.",
    interrupted:
      "The connection ended before the answer was complete. Please try again.",
    unsupported:
      "This content is not available in this chat. Please try again.",
    sources: "Sources",
    suggestions: "Suggested follow-ups",
    unavailable: "This response card is unavailable.",
    evidence: "Evidence",
    question: "Question",
    proposals: "Proposals",
    representation: "Representation",
    emptyTitle: "Start a conversation",
    emptyDescription: "Ask a question to explore what I can help you find.",
    suggestionPrompts: "Suggestions",
    suggestionCards: "Response cards",
    suggestionGroup: "Opening suggestions",
    defaultSuggestions: [
      "What can you help me find?",
      "How do your answers use sources?",
      "What can I ask about?",
    ],
    componentSuggestions: [
      { label: "Preview all response cards" },
      { component: "Evidence", label: "Show an evidence card" },
      { component: "Progress", label: "Show a progress card" },
      { component: "Question", label: "Preview a question card" },
      { component: "ProposalBatch", label: "Show a proposal card" },
      { component: "Representation", label: "Show a representation card" },
    ],
  },
  es: {
    defaultTitle: "Pregunta a ContextRocket",
    poweredBy: "Con tecnología de ContextRocket",
    poweredByLabel: "Con tecnología de",
    generic: "Algo salió mal. Inténtalo de nuevo.",
    demoResponse:
      "Esta vista previa usa contenido de ejemplo para mostrar las tarjetas estructuradas del chat. Configura el modo en vivo para conectar el agente de una organización.",
    demoProgress: "Vista previa · revisando fuentes de ejemplo",
    demoEvidenceTitle: "Fuente de ejemplo",
    demoEvidenceExcerpt: "La evidencia de ejemplo muestra cómo una respuesta puede citar su fuente.",
    demoEvidenceTitleTwo: "Otra fuente",
    demoEvidenceExcerptTwo: "Cada tarjeta utiliza un componente JSON Render tipado.",
    demoQuestion: "¿Qué tema te gustaría explorar ahora?",
    demoProposal: "Una propuesta de ejemplo muestra cómo resumir una idea.",
    demoProposalTwo: "Las propuestas relacionadas se pueden agrupar.",
    demoSuggestions: ["¿Puedes contarme más?", "¿Qué puedo explorar ahora?", "Muéstrame un ejemplo."],
    open: "Abrir chat",
    close: "Cerrar chat",
    expand: "Expandir chat",
    collapse: "Salir de pantalla completa",
    send: "Enviar",
    stop: "Detener respuesta",
    retry: "Intentar de nuevo",
    placeholder: "Haz una pregunta…",
    working: "Pensando…",
    submitted: "Conectando…",
    inputRequired: "Se necesita una respuesta para continuar.",
    canceled: "Respuesta detenida. Puedes intentarlo de nuevo.",
    interrupted:
      "La conexión terminó antes de completar la respuesta. Inténtalo de nuevo.",
    unsupported:
      "Este contenido no está disponible en este chat. Inténtalo de nuevo.",
    sources: "Fuentes",
    suggestions: "Sugerencias",
    unavailable: "Esta tarjeta de respuesta no está disponible.",
    evidence: "Evidencias",
    question: "Pregunta",
    proposals: "Propuestas",
    representation: "Representación",
    emptyTitle: "Inicia una conversación",
    emptyDescription: "Haz una pregunta para descubrir qué puedo ayudarte a encontrar.",
    suggestionPrompts: "Sugerencias",
    suggestionCards: "Tarjetas de respuesta",
    suggestionGroup: "Sugerencias iniciales",
    defaultSuggestions: [
      "¿Qué puedes ayudarme a encontrar?",
      "¿Cómo usas fuentes en tus respuestas?",
      "¿Sobre qué puedo preguntar?",
    ],
    componentSuggestions: [
      { label: "Ver todas las tarjetas de respuesta" },
      { component: "Evidence", label: "Muéstrame una tarjeta de evidencia" },
      { component: "Progress", label: "Muéstrame una tarjeta de progreso" },
      { component: "Question", label: "Ver una tarjeta de pregunta" },
      { component: "ProposalBatch", label: "Muéstrame una tarjeta de propuesta" },
      { component: "Representation", label: "Muéstrame una tarjeta de representación" },
    ],
  },
  de: {
    defaultTitle: "Frag ContextRocket",
    poweredBy: "Mit ContextRocket",
    poweredByLabel: "Mit",
    generic: "Etwas ist schiefgelaufen. Versuch es erneut.",
    demoResponse:
      "Diese Vorschau verwendet Beispieldaten für die strukturierten Antwortkarten. Richte den Live-Modus ein, um den Agenten einer Organisation zu verbinden.",
    demoProgress: "Vorschau · Beispielquellen werden geprüft",
    demoEvidenceTitle: "Beispielquelle",
    demoEvidenceExcerpt: "Beispielbelege zeigen, wie eine Antwort ihre Quelle zitieren kann.",
    demoEvidenceTitleTwo: "Eine weitere Quelle",
    demoEvidenceExcerptTwo: "Jede Karte verwendet eine typisierte JSON-Render-Komponente.",
    demoQuestion: "Welches Thema möchtest du als Nächstes erkunden?",
    demoProposal: "Ein Beispielvorschlag zeigt, wie sich eine Idee zusammenfassen lässt.",
    demoProposalTwo: "Verwandte Vorschläge lassen sich gruppieren.",
    demoSuggestions: ["Kannst du mehr dazu sagen?", "Was kann ich als Nächstes erkunden?", "Zeig mir ein Beispiel."],
    open: "Chat öffnen",
    close: "Chat schließen",
    expand: "Chat maximieren",
    collapse: "Vollbild verlassen",
    send: "Senden",
    stop: "Antwort stoppen",
    retry: "Erneut versuchen",
    placeholder: "Frage stellen…",
    working: "Denkt nach…",
    submitted: "Verbindung wird hergestellt…",
    inputRequired: "Für die Fortsetzung ist eine Antwort erforderlich.",
    canceled: "Antwort gestoppt. Du kannst es erneut versuchen.",
    interrupted:
      "Die Verbindung endete vor Abschluss der Antwort. Bitte erneut versuchen.",
    unsupported:
      "Dieser Inhalt ist in diesem Chat nicht verfügbar. Bitte erneut versuchen.",
    sources: "Quellen",
    suggestions: "Vorschläge",
    unavailable: "Diese Antwortkarte ist nicht verfügbar.",
    evidence: "Belege",
    question: "Frage",
    proposals: "Vorschläge",
    representation: "Darstellung",
    emptyTitle: "Gespräch beginnen",
    emptyDescription: "Stelle eine Frage und entdecke, wobei ich dir helfen kann.",
    suggestionPrompts: "Vorschläge",
    suggestionCards: "Antwortkarten",
    suggestionGroup: "Einstiegsvorschläge",
    defaultSuggestions: [
      "Wobei kannst du mir helfen?",
      "Wie belegst du deine Antworten?",
      "Was kann ich fragen?",
    ],
    componentSuggestions: [
      { label: "Alle Antwortkarten ansehen" },
      { component: "Evidence", label: "Zeig mir eine Quellenkarte" },
      { component: "Progress", label: "Zeig mir eine Fortschrittskarte" },
      { component: "Question", label: "Eine Fragekarte ansehen" },
      { component: "ProposalBatch", label: "Zeig mir eine Vorschlagskarte" },
      { component: "Representation", label: "Zeig mir eine Repräsentationskarte" },
    ],
  },
  zh: {
    defaultTitle: "询问 ContextRocket", poweredBy: "由 ContextRocket 提供支持", poweredByLabel: "由以下提供支持",
    generic: "出了点问题，请重试。", demoResponse: "此预览使用示例内容展示聊天可呈现的结构化回复卡片。配置实时模式即可连接组织代理。",
    demoProgress: "预览 · 正在检查示例来源", demoEvidenceTitle: "示例来源", demoEvidenceExcerpt: "示例证据展示了回复如何引用来源。",
    demoEvidenceTitleTwo: "另一个来源", demoEvidenceExcerptTwo: "每张卡片都使用类型化的 JSON Render 组件。", demoQuestion: "接下来想了解哪个主题？",
    demoProposal: "示例方案展示了如何总结一个想法。", demoProposalTwo: "相关方案可以组合展示。", demoSuggestions: ["可以再详细介绍吗？", "接下来可以了解什么？", "给我看一个示例。"], open: "打开聊天", close: "关闭聊天",
    expand: "展开聊天", collapse: "退出全屏", send: "发送", stop: "停止回复", retry: "重试", placeholder: "请输入问题…",
    working: "正在思考…", submitted: "正在连接…", inputRequired: "请填写回复后继续。", canceled: "回复已停止，您可以重试。",
    interrupted: "连接在回复完成前中断，请重试。", unsupported: "此聊天暂不支持该内容，请重试。", sources: "来源",
    suggestions: "后续建议", unavailable: "此回复卡片暂不可用。", evidence: "依据", question: "问题", proposals: "方案",
    representation: "表示方式", emptyTitle: "开始对话", emptyDescription: "提出问题，看看我能为您查找什么。",
    suggestionPrompts: "建议", suggestionCards: "回复卡片", suggestionGroup: "开场建议",
    defaultSuggestions: ["您能帮我查找什么？", "您的回答如何引用来源？", "我可以询问哪些内容？"],
    componentSuggestions: [
      { label: "预览所有回复卡片" }, { component: "Evidence", label: "显示证据卡片" },
      { component: "Progress", label: "显示进度卡片" }, { component: "Question", label: "预览问题卡片" },
      { component: "ProposalBatch", label: "显示方案卡片" }, { component: "Representation", label: "显示表示卡片" },
    ],
  },
} as const;

export type WidgetCopy = (typeof COPY)[keyof typeof COPY];

export function copyFor(config: WidgetConfig): WidgetCopy {
  return COPY[resolveWidgetLocale(config.locale)];
}
