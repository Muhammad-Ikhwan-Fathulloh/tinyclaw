import { describe, expect, test } from "bun:test";
import { openAIModelSupportsThinking } from "./thinking";

describe("openAIModelSupportsThinking", () => {
  test("denies gpt-4o-mini from the catalog", () => {
    expect(openAIModelSupportsThinking("gpt-4o-mini")).toBe(false);
  });

  test("allows gpt-5 models", () => {
    expect(openAIModelSupportsThinking("gpt-5.4")).toBe(true);
    expect(openAIModelSupportsThinking("gpt-5.3-codex")).toBe(true);
  });

  test("denies gpt-4o variants by prefix", () => {
    expect(openAIModelSupportsThinking("gpt-4o-2025-08")).toBe(false);
  });

  test("respects custom model overrides", () => {
    expect(
      openAIModelSupportsThinking("gpt-4o-mini", [
        { id: "gpt-4o-mini", supportsThinking: true },
      ]),
    ).toBe(true);
  });
});
