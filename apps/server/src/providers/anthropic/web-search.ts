import type {
  ChatCompletionResult,
  ChatMessage,
  GenerateChatInput,
  LlmToolDefinition,
  StreamChatHandlers,
  ToolCall,
} from "@tinyclaw/core";
import { toAnthropicUserContent, WEB_SEARCH_TOOL_NAME } from "@tinyclaw/core";
import {
  normalizeThinkingEffort,
  parseJsonRecord,
  readRecord,
  readSseEvents,
} from "../shared";

const MAX_PAUSE_CONTINUATIONS = 5;
const WEB_SEARCH_MAX_USES = 5;

type AnthropicContentBlock = Record<string, unknown>;

type AnthropicMessage = {
  role: "user" | "assistant";
  content: string | AnthropicContentBlock[];
};

export function buildAnthropicTools(
  tools: LlmToolDefinition[] | undefined,
  webSearch: boolean,
): unknown[] | undefined {
  const customTools = tools?.length ? tools.map(toAnthropicCustomTool) : [];
  const hostedTools = webSearch
    ? [
        {
          type: "web_search_20250305",
          name: WEB_SEARCH_TOOL_NAME,
          max_uses: WEB_SEARCH_MAX_USES,
        },
      ]
    : [];

  const combined = [...hostedTools, ...customTools];

  return combined.length > 0 ? combined : undefined;
}

export async function toAnthropicMessages(messages: ChatMessage[]): Promise<AnthropicMessage[]> {
  const result: AnthropicMessage[] = [];

  for (const message of messages) {
    if (message.role === "user") {
      result.push({
        role: "user",
        content: (await toAnthropicUserContent(message.content)) as
          | string
          | AnthropicContentBlock[],
      });
      continue;
    }

    if (message.role === "assistant") {
      if (message.providerContent?.length) {
        result.push({
          role: "assistant",
          content: message.providerContent as AnthropicContentBlock[],
        });
        continue;
      }

      const blocks: AnthropicContentBlock[] = [];

      if (message.content.trim()) {
        blocks.push({ type: "text", text: message.content });
      }

      for (const call of message.toolCalls ?? []) {
        blocks.push({
          type: "tool_use",
          id: call.id,
          name: call.name,
          input: call.arguments,
        });
      }

      result.push({
        role: "assistant",
        content: blocks.length > 0 ? blocks : message.content,
      });
      continue;
    }

    const last = result[result.length - 1];
    const toolResult: AnthropicContentBlock = {
      type: "tool_result",
      tool_use_id: message.toolCallId,
      content: message.content,
    };

    if (last?.role === "user" && Array.isArray(last.content)) {
      last.content.push(toolResult);
      continue;
    }

    result.push({
      role: "user",
      content: [toolResult],
    });
  }

  return result;
}

export function parseAnthropicContent(
  content: AnthropicContentBlock[] | undefined,
): ChatCompletionResult {
  const textParts: string[] = [];
  const thinkingParts: string[] = [];
  const toolCalls: ToolCall[] = [];

  for (const block of content ?? []) {
    if (block.type === "thinking" && typeof block.thinking === "string") {
      thinkingParts.push(block.thinking);
      continue;
    }

    if (block.type === "text" && typeof block.text === "string") {
      textParts.push(block.text);
      continue;
    }

    if (block.type === "tool_use") {
      toolCalls.push({
        id: String(block.id ?? ""),
        name: String(block.name ?? ""),
        arguments: readRecord(block.input),
      });
    }
  }

  const contentText = textParts.join("").trim();
  const thinkingText = thinkingParts.join("").trim();
  const providerContent = content?.length ? content : undefined;

  return {
    content: contentText,
    toolCalls,
    assistantMessage: {
      role: "assistant",
      content: contentText,
      ...(thinkingText ? { thinking: thinkingText } : {}),
      ...(toolCalls.length > 0 ? { toolCalls } : {}),
      ...(providerContent ? { providerContent } : {}),
    },
  };
}

export async function continueAnthropicUntilDone(options: {
  apiKey: string;
  model: string;
  system: string;
  messages: ChatMessage[];
  tools?: LlmToolDefinition[];
  webSearch: boolean;
  thinking?: GenerateChatInput["providerOptions"];
  stream: boolean;
  handlers?: StreamChatHandlers;
}): Promise<ChatCompletionResult> {
  let apiMessages = await toAnthropicMessages(options.messages);
  let combinedContent: AnthropicContentBlock[] = [];
  const tools = buildAnthropicTools(options.tools, options.webSearch);
  const thinkingRequest = buildAnthropicThinkingRequest(options.thinking);

  for (let attempt = 0; attempt < MAX_PAUSE_CONTINUATIONS; attempt += 1) {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": options.apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(
        buildAnthropicRequestBody({
          model: options.model,
          system: options.system,
          messages: apiMessages,
          tools,
          thinkingRequest,
          stream: options.stream,
        }),
      ),
    });

    if (!response.ok) {
      throw new Error(
        `Anthropic request failed (${response.status}): ${await response.text()}`,
      );
    }

    if (options.stream) {
      if (!response.body) {
        throw new Error("Anthropic returned an empty stream.");
      }

      const streamed = await readAnthropicStream(response.body, options.handlers);
      combinedContent.push(...(streamed.assistantMessage.providerContent ?? []));

      if (streamed.stopReason !== "pause_turn") {
        return finalizeAnthropicResult({
          parsed: parseAnthropicContent(combinedContent),
          content: streamed.content,
          toolCalls: streamed.toolCalls,
        });
      }

      apiMessages = appendAnthropicAssistantMessage(apiMessages, combinedContent);
      continue;
    }

    const payload = (await response.json()) as {
      content?: AnthropicContentBlock[];
      stop_reason?: string;
    };

    emitHostedToolEvents(payload.content, options.handlers);
    combinedContent.push(...(payload.content ?? []));

    if (payload.stop_reason !== "pause_turn") {
      return finalizeAnthropicResult({
        parsed: parseAnthropicContent(combinedContent),
      });
    }

    apiMessages = appendAnthropicAssistantMessage(apiMessages, combinedContent);
  }

  return finalizeAnthropicResult({
    parsed: parseAnthropicContent(combinedContent),
  });
}

interface StreamedAnthropicResult extends ChatCompletionResult {
  stopReason?: string;
}

async function readAnthropicStream(
  body: ReadableStream<Uint8Array>,
  handlers?: StreamChatHandlers,
): Promise<StreamedAnthropicResult> {
  let content = "";
  let stopReason: string | undefined;
  const pending = new Map<number, { id: string; name: string; inputJson: string }>();
  const providerContent: AnthropicContentBlock[] = [];
  const contentBlocks = new Map<number, AnthropicContentBlock>();

  await readSseEvents(body, ({ event, data }) => {
    const payload = JSON.parse(data) as Record<string, unknown>;

    if (event === "message_delta" || payload.type === "message_delta") {
      const delta = payload.delta as { stop_reason?: string } | undefined;
      stopReason = delta?.stop_reason ?? stopReason;
    }

    if (event === "content_block_start" || payload.type === "content_block_start") {
      const index = Number(payload.index ?? 0);
      const block = payload.content_block as AnthropicContentBlock | undefined;

      if (block) {
        contentBlocks.set(index, { ...block });
        providerContent[index] = { ...block };

        if (block.type === "tool_use") {
          pending.set(index, {
            id: String(block.id ?? ""),
            name: String(block.name ?? ""),
            inputJson: "",
          });
        }

        if (block.type === "server_tool_use") {
          handlers?.onToolStart?.({
            toolCallId: String(block.id ?? ""),
            tool: String(block.name ?? WEB_SEARCH_TOOL_NAME),
            input: readRecord(block.input),
          });
        }
      }
    }

    if (event === "content_block_delta" || payload.type === "content_block_delta") {
      const index = Number(payload.index ?? 0);
      const delta = readRecord(payload.delta);

      if (delta.type === "thinking_delta" && typeof delta.thinking === "string") {
        handlers?.onThinking?.(delta.thinking);

        const block = contentBlocks.get(index) ?? { type: "thinking", thinking: "" };
        block.thinking = `${String(block.thinking ?? "")}${delta.thinking}`;
        contentBlocks.set(index, block);
        providerContent[index] = block;
      }

      if (delta.type === "text_delta" && typeof delta.text === "string") {
        content += delta.text;
        handlers?.onChunk(delta.text);

        const block = contentBlocks.get(index) ?? { type: "text", text: "" };
        block.text = `${String(block.text ?? "")}${delta.text}`;
        contentBlocks.set(index, block);
        providerContent[index] = block;
      }

      if (delta.type === "input_json_delta" && typeof delta.partial_json === "string") {
        const current = pending.get(index) ?? { id: "", name: "", inputJson: "" };
        current.inputJson += delta.partial_json;
        pending.set(index, current);
      }
    }

    if (event === "content_block_stop" || payload.type === "content_block_stop") {
      const index = Number(payload.index ?? 0);
      const block = providerContent[index];

      if (block?.type === "web_search_tool_result") {
        handlers?.onToolEnd?.({
          toolCallId: String(block.tool_use_id ?? ""),
          tool: WEB_SEARCH_TOOL_NAME,
          result: block.content ?? block,
        });
      }
    }
  });

  const toolCalls = finalizeAnthropicToolCalls(pending);

  const normalizedContent = providerContent.filter(Boolean);
  const parsed = parseAnthropicContent(normalizedContent);

  return {
    ...finalizeAnthropicResult({
      parsed,
      content,
      toolCalls,
    }),
    stopReason,
  };
}

function buildAnthropicThinkingRequest(
  providerOptions: GenerateChatInput["providerOptions"],
): Record<string, unknown> {
  if (!providerOptions?.thinking?.enabled) {
    return {};
  }

  const effort = normalizeThinkingEffort(providerOptions.thinking.effort);

  return {
    thinking: { type: "adaptive" },
    output_config: { effort },
  };
}

function emitHostedToolEvents(
  content: AnthropicContentBlock[] | undefined,
  handlers?: StreamChatHandlers,
): void {
  if (!content?.length || !handlers) {
    return;
  }

  for (const block of content) {
    if (block.type === "server_tool_use") {
      handlers.onToolStart?.({
        toolCallId: String(block.id ?? ""),
        tool: String(block.name ?? WEB_SEARCH_TOOL_NAME),
        input: readRecord(block.input),
      });
    }

    if (block.type === "web_search_tool_result") {
      handlers.onToolEnd?.({
        toolCallId: String(block.tool_use_id ?? ""),
        tool: WEB_SEARCH_TOOL_NAME,
        result: block.content ?? block,
      });
    }
  }
}

function toAnthropicCustomTool(tool: LlmToolDefinition) {
  return {
    name: tool.name,
    description: tool.description,
    input_schema: tool.parameters,
  };
}

function buildAnthropicRequestBody(options: {
  model: string;
  system: string;
  messages: AnthropicMessage[];
  tools: unknown[] | undefined;
  thinkingRequest: Record<string, unknown>;
  stream: boolean;
}) {
  return {
    model: options.model,
    max_tokens: 4096,
    system: options.system,
    messages: options.messages,
    ...(options.tools ? { tools: options.tools } : {}),
    ...options.thinkingRequest,
    ...(options.stream ? { stream: true } : {}),
  };
}

function appendAnthropicAssistantMessage(
  messages: AnthropicMessage[],
  content: AnthropicContentBlock[],
): AnthropicMessage[] {
  return [...messages, { role: "assistant", content }];
}

function finalizeAnthropicToolCalls(
  pending: Map<number, { id: string; name: string; inputJson: string }>,
): ToolCall[] {
  return [...pending.entries()]
    .sort(([left], [right]) => left - right)
    .map(([, call]) => call)
    .flatMap((call) => {
      if (!call.id || !call.name) {
        return [];
      }

      return [
        {
          id: call.id,
          name: call.name,
          arguments: parseJsonRecord(call.inputJson),
        },
      ];
    });
}

function finalizeAnthropicResult(options: {
  parsed: ChatCompletionResult;
  content?: string;
  toolCalls?: ToolCall[];
}): ChatCompletionResult {
  const content = options.content?.trim() || options.parsed.content;
  const toolCalls = options.toolCalls ?? options.parsed.toolCalls;
  const providerContent = options.parsed.assistantMessage.providerContent;

  if (!content && toolCalls.length === 0 && !providerContent?.length) {
    throw new Error("Anthropic returned an empty response.");
  }

  return {
    ...options.parsed,
    content,
    toolCalls,
    assistantMessage: {
      ...options.parsed.assistantMessage,
      content,
      ...(toolCalls.length > 0 ? { toolCalls } : {}),
      ...(providerContent?.length ? { providerContent } : {}),
    },
  };
}
