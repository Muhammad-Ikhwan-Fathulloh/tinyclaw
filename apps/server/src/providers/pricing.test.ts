import { describe, expect, test } from "bun:test";
import { estimateUsageCostUsd, getModelPricing, hasCatalogPricing } from "./pricing";

describe("estimateUsageCostUsd", () => {
  test("computes cost from catalog pricing", () => {
    const cost = estimateUsageCostUsd("claude-sonnet-4-6", 1_000_000, 1_000_000);
    expect(cost).toBe(18);
  });

  test("uses fallback pricing for unknown models", () => {
    const pricing = getModelPricing("vendor/custom-model");
    expect(pricing?.inputPerMillionUsd).toBe(1);
    expect(pricing?.outputPerMillionUsd).toBe(3);
  });

  test("does not estimate compatible models without user pricing", () => {
    const pricing = getModelPricing("llama3.2", {
      provider: "openai_compatible",
      userConfig: {
        provider: "openai_compatible",
        apiKey: "k",
        customModels: [{ id: "llama3.2" }],
      },
    });

    expect(pricing).toBeNull();
    expect(
      estimateUsageCostUsd("llama3.2", 1_000, 500, {
        provider: "openai_compatible",
        userConfig: {
          provider: "openai_compatible",
          apiKey: "k",
          customModels: [{ id: "llama3.2" }],
        },
      }),
    ).toBe(0);
    expect(
      hasCatalogPricing("llama3.2", {
        provider: "openai_compatible",
        userConfig: {
          provider: "openai_compatible",
          apiKey: "k",
          customModels: [
            {
              id: "llama3.2",
              inputPerMillionUsd: 0,
              outputPerMillionUsd: 0,
            },
          ],
        },
      }),
    ).toBe(true);
  });
});
