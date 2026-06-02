import { describe, expect, test } from "bun:test";
import { detectProvider } from "./detect";

describe("detectProvider", () => {
  test("prefers OPENROUTER_API_KEY over OPENAI_API_KEY", () => {
    const provider = detectProvider({
      OPENROUTER_API_KEY: "sk-or-v1-test",
      OPENAI_API_KEY: "sk-test",
    });

    expect(provider).toBe("openrouter");
  });

  test("uses user config provider for OpenRouter custom models", () => {
    const provider = detectProvider(
      {},
      {
        provider: "openrouter",
        apiKey: "sk-or-v1-test",
        model: "google/gemini-2.5-pro-preview",
      },
    );

    expect(provider).toBe("openrouter");
  });
});
