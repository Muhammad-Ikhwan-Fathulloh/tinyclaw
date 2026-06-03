import type { ConfigureProviderRequest, ProviderModelOption } from "@tinyclaw/core/contract";
import { formatConfiguredProviderLabel } from "@tinyclaw/core/provider-label";
import type { UserProviderName } from "@tinyclaw/core/provider-resolution";

export type SelectedProvider = UserProviderName;

export const OPENROUTER_MODEL_SLUG_PATTERN = /^[\w.-]+\/[\w.:-]+$/;

export function isOpenRouterModelSlug(model: string): boolean {
  return OPENROUTER_MODEL_SLUG_PATTERN.test(model.trim());
}

export function filterModelsByProvider(
  models: ProviderModelOption[],
  provider: SelectedProvider | null | undefined,
): ProviderModelOption[] {
  if (!provider) {
    return models;
  }

  return models.filter((model) => model.provider === provider);
}

export function defaultModelForProvider(
  models: ProviderModelOption[],
  provider: SelectedProvider,
): string {
  const providerModels = filterModelsByProvider(models, provider);
  return (
    providerModels.find((model) => model.default)?.id ??
    providerModels[0]?.id ??
    ""
  );
}

export function formatProviderLabel(
  provider: string | null | undefined,
  displayName?: string | null,
): string {
  if (
    provider === "openai" ||
    provider === "anthropic" ||
    provider === "openrouter" ||
    provider === "gemini" ||
    provider === "openai_compatible"
  ) {
    return formatConfiguredProviderLabel(provider, displayName);
  }

  return provider ?? "Provider";
}

export const PROVIDER_OPTIONS: Array<{ id: SelectedProvider; label: string }> = [
  { id: "openai", label: "OpenAI" },
  { id: "anthropic", label: "Anthropic" },
  { id: "openrouter", label: "OpenRouter" },
  { id: "gemini", label: "Gemini" },
  { id: "openai_compatible", label: "Custom (OpenAI-compatible)" },
];

export function apiKeyPlaceholder(provider: SelectedProvider): string {
  if (provider === "anthropic") {
    return "sk-ant-…";
  }

  if (provider === "openrouter") {
    return "sk-or-v1-…";
  }

  if (provider === "gemini") {
    return "AIza…";
  }

  if (provider === "openai_compatible") {
    return "Optional for local endpoints";
  }

  return "sk-…";
}

export function validateApiKeyForProvider(
  apiKey: string,
  provider: SelectedProvider,
): string | null {
  if (provider === "openai_compatible") {
    return null;
  }

  if (!apiKey.trim()) {
    return "API key is required.";
  }

  return null;
}

export function validateDisplayNameInput(displayName: string): string | null {
  const trimmed = displayName.trim();

  if (!trimmed) {
    return "Provider name is required.";
  }

  return null;
}

export function validateBaseUrlInput(baseUrl: string): string | null {
  const trimmed = baseUrl.trim();

  if (!trimmed) {
    return "Base URL is required.";
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return "Base URL must use http or https.";
    }
  } catch {
    return "Enter a valid base URL.";
  }

  return null;
}

export function validateCustomModelsInput(
  models: Array<{ id: string }>,
): string | null {
  const valid = models.filter((model) => model.id.trim());

  if (valid.length === 0) {
    return "Add at least one model.";
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

export function getModelDisplayName(
  models: ProviderModelOption[],
  modelId: string | null | undefined,
): string {
  if (!modelId) {
    return "Unknown";
  }

  return models.find((model) => model.id === modelId)?.name ?? modelId;
}

export function resolveModelForProvider(
  provider: SelectedProvider,
  catalogModel: string,
  customModel?: string,
): string {
  const custom = customModel?.trim();

  if (provider === "openrouter" && custom) {
    return custom;
  }

  return catalogModel;
}

export function buildConfigureProviderRequest(options: {
  apiKey: string;
  provider: SelectedProvider;
  model?: string;
  displayName?: string;
  baseUrl?: string;
  customModels?: ConfigureProviderRequest["customModels"];
}): ConfigureProviderRequest {
  const request: ConfigureProviderRequest = {
    apiKey: options.apiKey,
    provider: options.provider,
    ...(options.model ? { model: options.model } : {}),
  };

  if (options.provider === "openai_compatible") {
    return {
      ...request,
      displayName: options.displayName?.trim(),
      baseUrl: options.baseUrl?.trim(),
      customModels: options.customModels,
    };
  }

  const baseUrl = options.baseUrl?.trim();
  if (baseUrl) {
    return { ...request, baseUrl };
  }

  return request;
}

export function modelsFromCustomRows(
  rows: Array<{ id: string; name?: string; default?: boolean; inputPerMillionUsd?: number; outputPerMillionUsd?: number }>,
): ProviderModelOption[] {
  return rows
    .filter((row) => row.id.trim())
    .map((row) => ({
      id: row.id.trim(),
      name: row.name?.trim() || row.id.trim(),
      provider: "openai_compatible" as const,
      ...(row.default ? { default: true } : {}),
    }));
}
