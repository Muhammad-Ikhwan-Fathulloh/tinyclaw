import { describe, expect, test } from "bun:test";
import { parseAnthropicContent } from "./index";

describe("parseAnthropicContent", () => {
  test("keeps thinking out of assistant content", () => {
    const result = parseAnthropicContent([
      { type: "thinking", thinking: "Plan the answer." },
      { type: "text", text: "Hello." },
    ]);

    expect(result.content).toBe("Hello.");
    expect(result.assistantMessage.thinking).toBe("Plan the answer.");
  });
});
