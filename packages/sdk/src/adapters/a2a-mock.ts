import type { A2AEvent, A2ATaskParams } from "../a2a-client.js";

// Used as a fallback when translating isn't possible outside of React context,
// though in `use-a2a-stream` we pass the translated response to this mock.
const DEFAULT_CANNED_RESPONSE = `This is a simulated response. The chat operates in an offline showcase mode.\n\nTo connect your own knowledge base:\n1. Create a free account at [ContextRocket](https://contextrocket.ai).\n2. Generate an Org Key.\n3. Add your key to \`.env.local\`.\n\nEnjoy exploring the UI!`;

export async function* mockStreamTask(
  params: A2ATaskParams,
  signal?: AbortSignal,
  localizedResponse?: string,
): AsyncGenerator<A2AEvent> {
  const responseText = localizedResponse || DEFAULT_CANNED_RESPONSE;
  const taskId = "task-" + Math.random().toString(36).slice(2);
  const threadId =
    params.sessionId ||
    params.metadata?.thread_id ||
    "thread-" + Math.random().toString(36).slice(2);

  // 1. Initial working event
  yield {
    type: "TaskStatusUpdateEvent",
    id: taskId,
    status: { state: "working", timestamp: new Date().toISOString() },
    final: false,
    metadata: { thread_id: threadId },
  };

  await new Promise((r) => setTimeout(r, 600));

  // 2. Stream the tokens (splitting carefully to not break markdown links aggressively,
  // but a simple space split is fine for the mock visual effect).
  // Use a regex to split by whitespace but keep the whitespace.
  const tokens = responseText.split(/(\s+)/);
  let index = 0;

  for (let i = 0; i < tokens.length; i++) {
    if (signal?.aborted) return;
    const isFirst = i === 0;
    const isLast = i === tokens.length - 1;
    const token = tokens[i];

    // Skip empty tokens if any
    if (token === "") continue;

    yield {
      type: "TaskArtifactUpdateEvent",
      id: taskId,
      artifact: {
        parts: [{ type: "text", text: token }],
        index,
        append: !isFirst,
        lastChunk: isLast,
      },
      final: false,
      metadata: { thread_id: threadId },
    };

    index++;
    // Simulate typing delay, slightly faster for whitespace
    await new Promise((r) =>
      setTimeout(r, token.trim() ? 20 + Math.random() * 30 : 5),
    );
  }

  // 3. Completed event
  yield {
    type: "TaskStatusUpdateEvent",
    id: taskId,
    status: {
      state: "completed",
      timestamp: new Date().toISOString(),
      message: {
        role: "agent",
        parts: [{ type: "text", text: responseText }],
      },
    },
    final: true,
    metadata: { thread_id: threadId },
  };
}
