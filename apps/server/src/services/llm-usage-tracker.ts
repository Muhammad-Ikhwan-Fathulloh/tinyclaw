import type { LlmUsageStats } from "@tinyclaw/core";
import {
  estimateUsageCostUsd,
  type PricingContext,
} from "../providers/pricing";

export class LlmUsageTracker {
  private requestCount = 0;
  private inputTokens = 0;
  private outputTokens = 0;
  private estimatedCostUsd = 0;
  private readonly trackedSince = new Date().toISOString();
  private pricingContext: PricingContext = {};

  setPricingContext(context: PricingContext): void {
    this.pricingContext = context;
  }

  record(modelId: string, inputTokens: number, outputTokens: number): void {
    this.requestCount += 1;
    this.inputTokens += inputTokens;
    this.outputTokens += outputTokens;
    this.estimatedCostUsd += estimateUsageCostUsd(
      modelId,
      inputTokens,
      outputTokens,
      this.pricingContext,
    );
  }

  getStats(): LlmUsageStats {
    return {
      requestCount: this.requestCount,
      inputTokens: this.inputTokens,
      outputTokens: this.outputTokens,
      totalTokens: this.inputTokens + this.outputTokens,
      estimatedCostUsd: this.estimatedCostUsd,
      trackedSince: this.trackedSince,
    };
  }
}
