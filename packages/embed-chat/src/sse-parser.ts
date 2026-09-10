export interface SSEEvent {
  type: string;
  data: string;
}

/** Minimal SSE parser -- mirrors frontend/lib/sse-parser.ts for standalone bundle. */
export async function* parseSSE(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  signal?: AbortSignal,
): AsyncGenerator<SSEEvent> {
  const decoder = new TextDecoder();
  let buffer = "";
  let eventType = "message";
  const dataLines: string[] = [];

  const abort = () => {
    void reader.cancel();
  };
  signal?.addEventListener("abort", abort, { once: true });

  try {
    while (!signal?.aborted) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (line.startsWith("event:")) {
          eventType = line.slice(6).trim();
        } else if (line.startsWith("data:")) {
          dataLines.push(line.slice(5).trim());
        } else if (line === "" && dataLines.length > 0) {
          yield { type: eventType, data: dataLines.join("\n") };
          eventType = "message";
          dataLines.length = 0;
        }
      }
    }
  } finally {
    signal?.removeEventListener("abort", abort);
    try {
      await reader.cancel();
    } finally {
      reader.releaseLock();
    }
  }
}
