import type {
  ChatCompletionResult,
  ChatMessage,
  GenerateChatInput,
  GenerateTextInput,
  LlmToolDefinition,
  ProviderClient,
  StreamChatHandlers,
  ToolCall,
} from "@tinyclaw/core";
import { normalizeBaseUrl } from "@tinyclaw/core";
import OpenAI from "openai";
import { buildChatCompletionResult, parseJsonRecord } from "../shared";
import {
  parseOpenAIToolCalls,
  toOpenAIMessages,
  toOpenAITools,
} from "../openai";

export interface OpenAICompatibleProviderOptions {
  apiKey: string;
  baseUrl: string;
  model: string;
  displayName: string;
}

interface PendingToolCall {
  id: string;
  name: string;
  arguments: string;
}

export function createOpenAICompatibleProvider(
  options: OpenAICompatibleProviderOptions,
): ProviderClient {
  const label = options.displayName.trim() || "Custom provider";
  const model = options.model;
  const client = new OpenAI({
    apiKey: options.apiKey || "not-needed",
    baseURL: normalizeBaseUrl(options.baseUrl),
  });

  return {
    name: "openai_compatible",
    generateText(input: GenerateTextInput) {
      const useJson = (input.format ?? "json") === "json";
      const system = useJson
        ? input.system
        : `${input.system}\n\nReturn only the requested text. No JSON, keys, labels, markdown fences, or surrounding quotes.`;

      return requestCompletion(client, label, {
        model,
        messages: [
          { role: "system", content: system },
          { role: "user", content: input.prompt },
        ],
        responseFormat: useJson ? { type: "json_object" } : undefined,
      });
    },
    generateChat(input: GenerateChatInput) {
      return requestChatCompletion(client, label, {
        model,
        system: input.system,
        messages: input.messages,
        tools: input.tools,
      });
    },
    streamChat(input: GenerateChatInput, handlers: StreamChatHandlers) {
      return streamChatCompletion(client, label, {
        model,
        system: input.system,
        messages: input.messages,
        tools: input.tools,
        handlers,
      });
    },
  };
}

function formatSdkError(label: string, error: unknown): Error {
  if (error instanceof OpenAI.APIError) {
    return new Error(`${label} request failed (${error.status}): ${error.message}`);
  }

  if (error instanceof Error) {
    return new Error(`${label} request failed: ${error.message}`);
  }

  return new Error(`${label} request failed.`);
}

async function buildMessages(system: string, messages: ChatMessage[]) {
  return toOpenAIMessages(system, messages) as OpenAI.Chat.ChatCompletionMessageParam[];
}

async function requestChatCompletion(
  client: OpenAI,
  label: string,
  options: {
    model: string;
    system: string;
    messages: ChatMessage[];
    tools?: LlmToolDefinition[];
  },
): Promise<ChatCompletionResult> {
  try {
    const completion = await client.chat.completions.create({
      model: options.model,
      messages: await buildMessages(options.system, options.messages),
      ...(options.tools?.length
        ? {
            tools: toOpenAITools(options.tools),
            tool_choice: "auto" as const,
          }
        : {}),
    });

    const message = completion.choices[0]?.message;
    const toolCalls = parseOpenAIToolCalls(
      message?.tool_calls as
        | Array<{
            id?: string;
            function?: { name?: string; arguments?: string };
          }>
        | undefined,
    );
    const content = message?.content ?? "";

    if (!content.trim() && toolCalls.length === 0) {
      throw new Error(`${label} returned an empty response.`);
    }

    return buildChatCompletionResult({ content, toolCalls });
  } catch (error) {
    throw formatSdkError(label, error);
  }
}

async function streamChatCompletion(
  client: OpenAI,
  label: string,
  options: {
    model: string;
    system: string;
    messages: ChatMessage[];
    tools?: LlmToolDefinition[];
    handlers: StreamChatHandlers;
  },
): Promise<ChatCompletionResult> {
  try {
    const stream = await client.chat.completions.create({
      model: options.model,
      stream: true,
      messages: await buildMessages(options.system, options.messages),
      ...(options.tools?.length
        ? {
            tools: toOpenAITools(options.tools),
            tool_choice: "auto" as const,
          }
        : {}),
    });

    let content = "";
    const pending = new Map<number, PendingToolCall>();

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta;

      if (delta?.content) {
        content += delta.content;
        options.handlers.onChunk(delta.content);
      }

      if (delta?.tool_calls) {
        for (const toolDelta of delta.tool_calls) {
          mergePendingToolCall(pending, toolDelta);
        }
      }
    }

    const toolCalls = finalizePendingToolCalls(pending);

    if (!content.trim() && toolCalls.length === 0) {
      throw new Error(`${label} returned an empty response.`);
    }

    return buildChatCompletionResult({ content, toolCalls });
  } catch (error) {
    throw formatSdkError(label, error);
  }
}

async function requestCompletion(
  client: OpenAI,
  label: string,
  options: {
    model: string;
    messages: Array<{ role: "system" | "user"; content: string }>;
    responseFormat?: { type: "json_object" };
  },
): Promise<string> {
  try {
    const completion = await client.chat.completions.create({
      model: options.model,
      messages: options.messages,
      ...(options.responseFormat
        ? { response_format: options.responseFormat }
        : {}),
    });

    const content = completion.choices[0]?.message?.content?.trim();

    if (!content) {
      throw new Error(`${label} returned an empty response.`);
    }

    return content;
  } catch (error) {
    throw formatSdkError(label, error);
  }
}

function mergePendingToolCall(
  pending: Map<number, PendingToolCall>,
  toolDelta: {
    index?: number;
    id?: string;
    function?: { name?: string; arguments?: string };
  },
): void {
  const index = toolDelta.index ?? 0;
  const current = pending.get(index) ?? {
    id: "",
    name: "",
    arguments: "",
  };

  if (toolDelta.id) {
    current.id = toolDelta.id;
  }

  if (toolDelta.function?.name) {
    current.name = toolDelta.function.name;
  }

  if (toolDelta.function?.arguments) {
    current.arguments += toolDelta.function.arguments;
  }

  pending.set(index, current);
}

function finalizePendingToolCalls(
  pending: Map<number, PendingToolCall>,
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
          arguments: parseJsonRecord(call.arguments),
        },
      ];
    });
}
