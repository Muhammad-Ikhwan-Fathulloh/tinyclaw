import type { ProviderModelOption } from "@tinyclaw/core/contract";
import {
  inferProviderFromApiKey,
  type UserProviderName,
} from "@tinyclaw/core/provider-inference";

export type InferredProvider = UserProviderName;
export { inferProviderFromApiKey };

const OPENROUTER_MODEL_SLUG_PATTERN = /^[\w.-]+\/[\w.:-]+$/;

export function isOpenRouterModelSlug(model: string): boolean {
  return OPENROUTER_MODEL_SLUG_PATTERN.test(model.trim());
}

export function filterModelsByProvider(
  models: ProviderModelOption[],
  provider: InferredProvider | null | undefined,
): ProviderModelOption[] {
  if (!provider) {
    return models;
  }

  return models.filter((model) => model.provider === provider);
}

export function defaultModelForProvider(
  models: ProviderModelOption[],
  provider: InferredProvider,
): string {
  const providerModels = filterModelsByProvider(models, provider);
  return (
    providerModels.find((model) => model.default)?.id ??
    providerModels[0]?.id ??
    ""
  );
}

export function formatProviderLabel(provider: string | null | undefined): string {
  if (provider === "openai") {
    return "OpenAI";
  }

  if (provider === "anthropic") {
    return "Anthropic";
  }

  if (provider === "openrouter") {
    return "OpenRouter";
  }

  return provider ?? "Provider";
}

export const PROVIDER_OPTIONS: Array<{ id: InferredProvider; label: string }> = [
  { id: "openai", label: "OpenAI" },
  { id: "anthropic", label: "Anthropic" },
  { id: "openrouter", label: "OpenRouter" },
];

export function apiKeyPlaceholder(provider: InferredProvider): string {
  if (provider === "anthropic") {
    return "sk-ant-…";
  }

  if (provider === "openrouter") {
    return "sk-or-v1-…";
  }

  return "sk-…";
}

export function apiKeyHint(provider: InferredProvider): string {
  if (provider === "anthropic") {
    return "Anthropic API keys start with sk-ant-";
  }

  if (provider === "openrouter") {
    return "OpenRouter API keys start with sk-or-";
  }

  return "OpenAI API keys start with sk-";
}

export function getModelDisplayName(
  models: ProviderModelOption[],
  modelId: string | null | undefined,
): string {
  if (!modelId) {
    return "Unknown";
  }

  return models.find((model) => model.id === modelId)?.name ?? modelId;
}

export function validateApiKeyForProvider(
  apiKey: string,
  provider: InferredProvider,
): string | null {
  const trimmed = apiKey.trim();

  if (!trimmed) {
    return "API key is required.";
  }

  const keyProvider = inferProviderFromApiKey(trimmed);

  if (keyProvider !== provider) {
    return `This looks like a ${formatProviderLabel(keyProvider)} key. Choose ${formatProviderLabel(keyProvider)} or paste a ${formatProviderLabel(provider)} key.`;
  }

  return null;
}

export function validateCustomOpenRouterModel(model: string): string | null {
  const trimmed = model.trim();

  if (!trimmed) {
    return null;
  }

  if (!isOpenRouterModelSlug(trimmed)) {
    return "Use vendor/model format, e.g. anthropic/claude-sonnet-4-6";
  }

  return null;
}

export function resolveModelForProvider(
  provider: InferredProvider,
  catalogModel: string,
  customModel?: string,
): string {
  const custom = customModel?.trim();

  if (provider === "openrouter" && custom) {
    return custom;
  }

  return catalogModel;
}
