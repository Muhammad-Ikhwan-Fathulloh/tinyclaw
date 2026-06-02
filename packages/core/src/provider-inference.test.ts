import { describe, expect, test } from "bun:test";
import { inferProviderFromApiKey } from "./provider-inference";

describe("inferProviderFromApiKey", () => {
  test("detects Anthropic keys", () => {
    expect(inferProviderFromApiKey("sk-ant-api03-test")).toBe("anthropic");
  });

  test("detects OpenRouter keys", () => {
    expect(inferProviderFromApiKey("sk-or-v1-test")).toBe("openrouter");
  });

  test("defaults to OpenAI for other sk- keys", () => {
    expect(inferProviderFromApiKey("sk-test")).toBe("openai");
  });
});
