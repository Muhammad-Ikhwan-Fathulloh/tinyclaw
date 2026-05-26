import { describe, expect, test } from "bun:test";
import { isClipboardImagePasteSupported } from "./clipboard-image";

describe("clipboard-image helpers", () => {
  test("isClipboardImagePasteSupported", () => {
    expect(isClipboardImagePasteSupported()).toBe(true);
  });
});
