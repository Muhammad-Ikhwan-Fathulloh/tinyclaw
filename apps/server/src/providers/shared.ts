import type {
  ChatCompletionResult,
  ChatMessage,
  ThinkingEffort,
  ToolCall,
} from "@tinyclaw/core";

export function buildChatCompletionResult(options: {
  content: string | null | undefined;
  toolCalls: ToolCall[];
  thinking?: string | null | undefined;
}): ChatCompletionResult {
  const content = options.content?.trim() ?? "";
  const thinking = options.thinking?.trim();
  const assistantMessage: Extract<ChatMessage, { role: "assistant" }> = {
    role: "assistant",
    content,
    ...(thinking ? { thinking } : {}),
    ...(options.toolCalls.length > 0 ? { toolCalls: options.toolCalls } : {}),
  };

  return {
    content,
    toolCalls: options.toolCalls,
    assistantMessage,
  };
}

export interface SseEvent {
  event: string;
  data: string;
}

export async function readSseEvents(
  body: ReadableStream<Uint8Array>,
  onEvent: (event: SseEvent) => void | Promise<void>,
): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();

    if (value) {
      buffer += decoder.decode(value, { stream: true });
    }

    if (done) {
      buffer += decoder.decode();
    }

    while (true) {
      const boundary = findSseBoundary(buffer);

      if (!boundary) {
        break;
      }

      const eventBlock = buffer.slice(0, boundary.index);
      buffer = buffer.slice(boundary.index + boundary.length);
      await emitSseEvent(eventBlock, onEvent);
    }

    if (done) {
      break;
    }
  }

  if (buffer.trim()) {
    await emitSseEvent(buffer, onEvent);
  }
}

async function emitSseEvent(
  eventBlock: string,
  onEvent: (event: SseEvent) => void | Promise<void>,
): Promise<void> {
  let event = "message";
  const dataLines: string[] = [];

  for (const line of eventBlock.split(/\r?\n/)) {
    const eventValue = readSseField(line, "event:");

    if (eventValue !== null) {
      event = eventValue.trim() || "message";
      continue;
    }

    const dataValue = readSseField(line, "data:");

    if (dataValue !== null) {
      dataLines.push(dataValue);
    }
  }

  const data = dataLines.join("\n");
  const normalized = data.trim();

  if (!normalized || normalized === "[DONE]") {
    return;
  }

  await onEvent({ event, data });
}

function findSseBoundary(
  buffer: string,
): { index: number; length: number } | null {
  const match = /\r?\n\r?\n/.exec(buffer);

  if (!match || match.index === undefined) {
    return null;
  }

  return {
    index: match.index,
    length: match[0].length,
  };
}

function readSseField(line: string, prefix: string): string | null {
  if (!line.startsWith(prefix)) {
    return null;
  }

  let value = line.slice(prefix.length);

  if (value.startsWith(" ")) {
    value = value.slice(1);
  }

  return value;
}

export function parseJsonRecord(raw: string): Record<string, unknown> {
  const trimmed = raw.trim();

  if (!trimmed) {
    return {};
  }

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    return readRecord(parsed);
  } catch {
    return {};
  }
}

export function readRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function normalizeThinkingEffort(
  effort: ThinkingEffort | undefined,
): ThinkingEffort {
  if (effort === "low" || effort === "medium" || effort === "high") {
    return effort;
  }

  return "medium";
}
