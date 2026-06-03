import {
  findCustomModel,
  normalizeBaseUrl,
  type CustomModelEntry,
} from "@tinyclaw/core";
import type { ProviderName, UserProviderConfig } from "@tinyclaw/core";
import OpenAI from "openai";
import type { ProviderModelOption } from "./models";
import { AVAILABLE_MODELS, getDefaultModel } from "./models";

const DEFAULT_CONTEXT_WINDOW = 128_000;
const DEFAULT_MAX_OUTPUT = 8_192;

export function customModelsToCatalog(
  entries: CustomModelEntry[],
): ProviderModelOption[] {
  return entries.map((entry) => ({
    id: entry.id,
    name: entry.name?.trim() || entry.id,
    provider: "openai_compatible",
    contextWindow: DEFAULT_CONTEXT_WINDOW,
    maxOutputTokens: DEFAULT_MAX_OUTPUT,
    ...(entry.default ? { default: true } : {}),
    ...(entry.inputPerMillionUsd !== undefined
      ? { inputPerMillionUsd: entry.inputPerMillionUsd }
      : {}),
    ...(entry.outputPerMillionUsd !== undefined
      ? { outputPerMillionUsd: entry.outputPerMillionUsd }
      : {}),
  }));
}

export function ensureCurrentModelInCatalog(
  catalog: ProviderModelOption[],
  currentModel: string | null | undefined,
): ProviderModelOption[] {
  const trimmed = currentModel?.trim();

  if (!trimmed || catalog.some((model) => model.id === trimmed)) {
    return catalog;
  }

  return [
    ...catalog,
    {
      id: trimmed,
      name: trimmed,
      provider: "openai_compatible",
      contextWindow: DEFAULT_CONTEXT_WINDOW,
      maxOutputTokens: DEFAULT_MAX_OUTPUT,
    },
  ];
}

export function getModelsForConfiguredProvider(
  provider: ProviderName | null,
  userConfig: UserProviderConfig | null | undefined,
  currentModel?: string | null,
): ProviderModelOption[] {
  if (provider === "openai_compatible") {
    const entries = userConfig?.customModels ?? [];
    const catalog = ensureCurrentModelInCatalog(
      customModelsToCatalog(entries),
      currentModel ?? userConfig?.model,
    );
    return catalog;
  }

  if (!provider) {
    return AVAILABLE_MODELS;
  }

  return AVAILABLE_MODELS.filter((model) => model.provider === provider);
}

export async function fetchRemoteOpenAIModels(
  baseUrl: string,
  apiKey: string,
): Promise<CustomModelEntry[]> {
  const normalized = normalizeBaseUrl(baseUrl);
  const client = new OpenAI({
    apiKey: apiKey || "not-needed",
    baseURL: normalized,
  });

  try {
    const page = await client.models.list();
    const ids = new Set<string>();

    for await (const model of page) {
      const id = model.id?.trim();

      if (id) {
        ids.add(id);
      }
    }

    if (ids.size > 0) {
      return [...ids]
        .sort((left, right) => left.localeCompare(right))
        .map((id) => ({ id, name: id }));
    }
  } catch {
    // Fall through to raw fetch for hosts without SDK-compatible models.list.
  }

  return fetchRemoteOpenAIModelsRaw(normalized, apiKey);
}

async function fetchRemoteOpenAIModelsRaw(
  baseUrl: string,
  apiKey: string,
): Promise<CustomModelEntry[]> {
  const response = await fetch(`${baseUrl}/models`, {
    headers: {
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(
      `Could not fetch models (${response.status}): ${await response.text()}`,
    );
  }

  const payload = (await response.json()) as {
    data?: Array<{ id?: string }>;
  };

  const ids = (payload.data ?? [])
    .map((entry) => entry.id?.trim())
    .filter((id): id is string => Boolean(id));

  if (ids.length === 0) {
    throw new Error("Remote models response did not include any model ids.");
  }

  return [...new Set(ids)]
    .sort((left, right) => left.localeCompare(right))
    .map((id) => ({ id, name: id }));
}

export function resolveCompatibleDefaultModel(
  customModels: CustomModelEntry[] | undefined,
  model?: string,
): string {
  const trimmed = model?.trim();

  if (trimmed && findCustomModel(customModels, trimmed)) {
    return trimmed;
  }

  const catalog = customModelsToCatalog(customModels ?? []);
  return catalog.find((entry) => entry.default)?.id ?? catalog[0]?.id ?? "custom-model";
}

export function isCompatibleModelId(
  modelId: string,
  customModels: CustomModelEntry[] | undefined,
): boolean {
  return Boolean(findCustomModel(customModels, modelId));
}
