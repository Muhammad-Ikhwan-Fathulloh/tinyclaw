import { describe, expect, test } from "bun:test";
import type { ChatMessage } from "./contract";
import { messagesIncludeUserImages } from "./message-content";

describe("messagesIncludeUserImages", () => {
  test("detects image parts in user messages", () => {
    const messages: ChatMessage[] = [
      { role: "user", content: "hello" },
      {
        role: "user",
        content: [
          { type: "text", text: "see this" },
          { type: "image", mediaType: "image/png", data: "abc" },
        ],
      },
    ];

    expect(messagesIncludeUserImages(messages)).toBe(true);
  });

  test("returns false for text-only history", () => {
    const messages: ChatMessage[] = [
      { role: "user", content: "hello" },
      { role: "assistant", content: "hi" },
    ];

    expect(messagesIncludeUserImages(messages)).toBe(false);
  });
});
