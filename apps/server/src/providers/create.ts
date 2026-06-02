import { createAnthropicProvider } from "./anthropic";
import { detectProvider } from "./detect";
import { readEnvValue, type ProviderClient, type ProviderName } from "@tinyclaw/core";
import { resolveModel } from "./models";
import { createOpenAIProvider } from "./openai";
import { createOpenRouterProvider } from "./openrouter";
import type { UserProviderConfig } from "@tinyclaw/core";

export interface CreateProviderOptions {
  provider: ProviderName;
  apiKey: string;
  model?: string;
}

export function createProvider(options: CreateProviderOptions): ProviderClient {
  const model = resolveModel(options.provider, options.model);

  switch (options.provider) {
    case "openai":
      return createOpenAIProvider({
        apiKey: options.apiKey,
        model,
      });
    case "anthropic":
      return createAnthropicProvider({
        apiKey: options.apiKey,
        model,
      });
    case "openrouter":
      return createOpenRouterProvider({
        apiKey: options.apiKey,
        model,
      });
  }
}

function readApiKeyForProvider(
  provider: ProviderName,
  env: Record<string, string | undefined>,
  userConfig?: UserProviderConfig | null,
): string | undefined {
  const envKey =
    provider === "openai"
      ? "OPENAI_API_KEY"
      : provider === "anthropic"
        ? "ANTHROPIC_API_KEY"
        : "OPENROUTER_API_KEY";

  return readEnvValue(env, envKey) ?? userConfig?.apiKey;
}

export function createProviderFromEnv(
  env: Record<string, string | undefined> = process.env,
): ProviderClient | null {
  return createProviderFromSources(env);
}

export function createProviderFromSources(
  env: Record<string, string | undefined> = process.env,
  userConfig?: UserProviderConfig | null,
): ProviderClient | null {
  const provider = detectProvider(env, userConfig);

  if (!provider) {
    return null;
  }

  const apiKey = readApiKeyForProvider(provider, env, userConfig);

  if (!apiKey?.trim()) {
    return null;
  }

  return createProvider({
    provider,
    apiKey,
    model: readEnvValue(env, "TINYCLAW_MODEL") ?? userConfig?.model,
  });
}
