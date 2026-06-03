import { findCustomModel, type ProviderName } from "@tinyclaw/core";
import type { UserProviderConfig } from "@tinyclaw/core";
import { getModelById } from "./models";

export interface ModelPricing {
  /** USD per 1M input tokens */
  inputPerMillionUsd: number;
  /** USD per 1M output tokens */
  outputPerMillionUsd: number;
}

const DEFAULT_PRICING: ModelPricing = {
  inputPerMillionUsd: 1,
  outputPerMillionUsd: 3,
};

export interface PricingContext {
  provider?: ProviderName | null;
  userConfig?: UserProviderConfig | null;
}

export function getModelPricing(
  modelId: string,
  context: PricingContext = {},
): ModelPricing | null {
  const provider = context.provider ?? context.userConfig?.provider ?? null;

  if (provider === "openai_compatible") {
    const entry = findCustomModel(context.userConfig?.customModels, modelId);

    if (
      entry?.inputPerMillionUsd !== undefined &&
      entry.outputPerMillionUsd !== undefined
    ) {
      return {
        inputPerMillionUsd: entry.inputPerMillionUsd,
        outputPerMillionUsd: entry.outputPerMillionUsd,
      };
    }

    return null;
  }

  const catalog = getModelById(modelId);

  if (catalog?.inputPerMillionUsd != null && catalog.outputPerMillionUsd != null) {
    return {
      inputPerMillionUsd: catalog.inputPerMillionUsd,
      outputPerMillionUsd: catalog.outputPerMillionUsd,
    };
  }

  return DEFAULT_PRICING;
}

export function estimateUsageCostUsd(
  modelId: string,
  inputTokens: number,
  outputTokens: number,
  context: PricingContext = {},
): number {
  const pricing = getModelPricing(modelId, context);

  if (!pricing) {
    return 0;
  }

  const inputCost = (inputTokens / 1_000_000) * pricing.inputPerMillionUsd;
  const outputCost = (outputTokens / 1_000_000) * pricing.outputPerMillionUsd;
  return inputCost + outputCost;
}

export function hasCatalogPricing(
  modelId: string,
  context: PricingContext = {},
): boolean {
  return getModelPricing(modelId, context) !== null;
}

export function isCostEstimated(
  provider: ProviderName | null,
  modelId: string | null,
  userConfig: UserProviderConfig | null | undefined,
): boolean {
  if (!provider || !modelId) {
    return false;
  }

  if (provider === "openai_compatible") {
    return hasCatalogPricing(modelId, { provider, userConfig });
  }

  return hasCatalogPricing(modelId, { provider, userConfig });
}
