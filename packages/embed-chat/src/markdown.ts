import { safeHref } from "./safe-url";

/**
 * Small, dependency-free Markdown renderer for the Shadow DOM widget.
 *
 * It intentionally builds DOM nodes instead of assigning innerHTML. That
 * keeps assistant content inert even when the host page has a permissive CSP
 * or the agent returns raw HTML-looking text.
 */
export function renderMarkdown(container: HTMLElement, markdown: string): void {
  const lines = markdown.split(/\r?\n/);
  let inCode = false;
  let codeLines: string[] = [];

  const appendParagraph = (text: string, className?: string) => {
    const paragraph = document.createElement("p");
    if (className) paragraph.className = className;
    appendInline(paragraph, text);
    container.appendChild(paragraph);
  };

  for (const line of lines) {
    if (line.trim().startsWith("```")) {
      if (inCode) {
        const pre = document.createElement("pre");
        const code = document.createElement("code");
        code.textContent = codeLines.join("\n");
        pre.appendChild(code);
        container.appendChild(pre);
        codeLines = [];
      }
      inCode = !inCode;
      continue;
    }

    if (inCode) {
      codeLines.push(line);
      continue;
    }

    const heading = line.match(/^#{1,6}\s+(.+)$/);
    if (heading) {
      const paragraph = document.createElement("p");
      paragraph.className = "cr-markdown-heading";
      const strong = document.createElement("strong");
      strong.textContent = heading[1];
      paragraph.appendChild(strong);
      container.appendChild(paragraph);
      continue;
    }

    const bullet = line.match(/^\s*[-*+]\s+(.+)$/);
    if (bullet) {
      const list = document.createElement("ul");
      const item = document.createElement("li");
      appendInline(item, bullet[1]);
      list.appendChild(item);
      container.appendChild(list);
      continue;
    }

    const ordered = line.match(/^\s*\d+[.)]\s+(.+)$/);
    if (ordered) {
      const list = document.createElement("ol");
      const item = document.createElement("li");
      appendInline(item, ordered[1]);
      list.appendChild(item);
      container.appendChild(list);
      continue;
    }

    if (line.trim()) {
      appendParagraph(line);
    }
  }

  if (inCode && codeLines.length > 0) {
    const pre = document.createElement("pre");
    const code = document.createElement("code");
    code.textContent = codeLines.join("\n");
    pre.appendChild(code);
    container.appendChild(pre);
  }
}

function appendInline(parent: HTMLElement, text: string): void {
  const tokenPattern =
    /(\[([^\]]+)\]\(([^)\s]+)\)|\*\*([^*]+)\*\*|__([^_]+)__|`([^`]+)`|\*([^*]+)\*|_([^_]+)_)/g;
  let cursor = 0;

  for (const match of text.matchAll(tokenPattern)) {
    const index = match.index ?? 0;
    if (index > cursor)
      parent.appendChild(document.createTextNode(text.slice(cursor, index)));

    if (match[2] && match[3]) {
      const href = safeHref(match[3]);
      if (href) {
        const link = document.createElement("a");
        link.href = href;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.textContent = match[2];
        parent.appendChild(link);
      } else {
        parent.appendChild(document.createTextNode(match[2]));
      }
    } else if (match[4] || match[5] || match[7] || match[8]) {
      const strong = document.createElement(
        match[4] || match[5] ? "strong" : "em",
      );
      strong.textContent = match[4] || match[5] || match[7] || match[8] || "";
      parent.appendChild(strong);
    } else if (match[6]) {
      const code = document.createElement("code");
      code.textContent = match[6];
      parent.appendChild(code);
    }

    cursor = index + match[0].length;
  }

  if (cursor < text.length)
    parent.appendChild(document.createTextNode(text.slice(cursor)));
}
