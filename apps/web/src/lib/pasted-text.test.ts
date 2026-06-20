import { describe, expect, test } from "bun:test";
import {
  countWords,
  createPastedTextFile,
  isPastedTextDocument,
  LONG_PASTE_WORD_THRESHOLD,
  pastedTextFilename,
  wordCountFromPastedFilename,
} from "./pasted-text";

describe("countWords", () => {
  test("counts whitespace-separated tokens", () => {
    expect(countWords("one two three")).toBe(3);
  });

  test("normalizes Windows line endings", () => {
    expect(countWords("a\r\nb\rc")).toBe(3);
  });

  test("returns 0 for empty text", () => {
    expect(countWords("   \n\t  ")).toBe(0);
  });

  test("boundary at threshold", () => {
    const words299 = Array.from({ length: 299 }, (_, i) => `w${i}`).join(" ");
    const words300 = Array.from({ length: 300 }, (_, i) => `w${i}`).join(" ");
    const words301 = Array.from({ length: 301 }, (_, i) => `w${i}`).join(" ");

    expect(countWords(words299)).toBe(299);
    expect(countWords(words300)).toBe(300);
    expect(countWords(words301)).toBe(301);
    expect(words301.split(/\s+/).length).toBeGreaterThan(LONG_PASTE_WORD_THRESHOLD);
  });
});

describe("createPastedTextFile", () => {
  test("names file with word count", () => {
    const text = Array.from({ length: 301 }, (_, i) => `word${i}`).join(" ");
    const file = createPastedTextFile(text);

    expect(file.type.startsWith("text/plain")).toBe(true);
    expect(file.name).toBe(pastedTextFilename(301));
    expect(isPastedTextDocument(file.name, file.type)).toBe(true);
    expect(wordCountFromPastedFilename(file.name)).toBe(301);
  });
});
