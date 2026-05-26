import * as readline from "node:readline/promises";
import type { ImageAttachment } from "@tinyclaw/core";
import type { PromptSuggestion } from "./commands";
import { isClipboardImagePasteSupported, readClipboardImage } from "./clipboard-image";

const BRACKETED_PASTE_START = "\x1b[200~";
const BRACKETED_PASTE_END = "\x1b[201~";

const BLINK_INTERVAL_MS = 530;
const CURSOR_CHAR = "▌";
const MAX_VISIBLE_SUGGESTIONS = 8;

export class PromptCancelledError extends Error {
  constructor() {
    super("Prompt cancelled");
    this.name = "PromptCancelledError";
  }
}

export interface PromptLineOptions {
  getSuggestions?: (input: string) => PromptSuggestion[];
}

export interface PromptLineResult {
  text: string;
  images?: ImageAttachment[];
}

export async function promptLine(
  prefix = "> ",
  options: PromptLineOptions = {},
): Promise<PromptLineResult> {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    return promptLineFallback(prefix);
  }

  const getSuggestions = options.getSuggestions ?? (() => []);

  return new Promise((resolve, reject) => {
    const stdin = process.stdin;
    const stdout = process.stdout;
    let value = "";
    let attachedImages: ImageAttachment[] = [];
    let cursorVisible = true;
    let closed = false;
    let selectedIndex = 0;
    let previousRenderedLines = 0;
    let hasNavigated = false;
    let pasteBuffer = "";
    let inBracketedPaste = false;
    let clipboardAttachTask: Promise<void> = Promise.resolve();
    const clipboardPasteSupported = isClipboardImagePasteSupported();

    const blinkTimer = setInterval(() => {
      cursorVisible = !cursorVisible;
      render();
    }, BLINK_INTERVAL_MS);

    function currentSuggestions(): PromptSuggestion[] {
      return getSuggestions(value).slice(0, MAX_VISIBLE_SUGGESTIONS);
    }

    function cursorColumn(): number {
      return prefix.length + value.length + 1;
    }

    function render() {
      const suggestions = currentSuggestions();
      const cursor = cursorVisible ? CURSOR_CHAR : " ";
      const renderedLines = Math.max(suggestions.length, previousRenderedLines);

      stdout.write(`\r\x1b[K${prefix}${value}${cursor}`);

      for (let index = 0; index < renderedLines; index += 1) {
        const suggestion = suggestions[index];

        if (suggestion) {
          const selected = index === selectedIndex;
          const marker = selected ? "›" : " ";
          const content = `${marker} ${suggestion.label.padEnd(14)} ${suggestion.description}`;

          if (selected) {
            stdout.write(`\n\x1b[K\x1b[36m${content}\x1b[0m`);
          } else {
            stdout.write(`\n\x1b[K${content}`);
          }
        } else {
          stdout.write("\n\x1b[K");
        }
      }

      if (renderedLines > 0) {
        stdout.write(`\x1b[${renderedLines}A`);
      }

      previousRenderedLines = suggestions.length;
      stdout.write(`\r\x1b[${cursorColumn()}C`);
    }

    function clearBelowInput() {
      stdout.write(`\r\x1b[${cursorColumn()}C\x1b[J`);
    }

    function applySuggestion(suggestion: PromptSuggestion, submitAfter = false) {
      value = suggestion.insertValue.trimEnd();
      selectedIndex = 0;
      hasNavigated = false;
      cursorVisible = true;

      if (submitAfter) {
        void waitForClipboardAttach().then(() => {
          cleanup();
          resolve({
            text: value,
            images: attachedImages.length > 0 ? attachedImages : undefined,
          });
        });
        return;
      }

      render();
    }

    function resetSelection() {
      selectedIndex = 0;
      hasNavigated = false;
    }

    function cleanup() {
      if (closed) {
        return;
      }

      closed = true;
      clearInterval(blinkTimer);
      stdin.setRawMode(false);
      stdin.off("data", onData);
      stdout.write("\x1b[?25h");
      clearBelowInput();
      stdout.write(`\r\x1b[K${prefix}${value}\n`);
    }

    function notifyClipboard(message: string) {
      process.stderr.write(`\x1b[33m${message}\x1b[0m\n`);
      render();
    }

    function queueClipboardAttach(): void {
      clipboardAttachTask = attachClipboardImage().then(() => undefined);
    }

    async function waitForClipboardAttach(): Promise<void> {
      await clipboardAttachTask;
    }

    async function attachClipboardImage(): Promise<boolean> {
      if (!clipboardPasteSupported) {
        notifyClipboard("Clipboard images are not supported on this platform.");
        return false;
      }

      try {
        const image = await readClipboardImage();

        if (!image) {
          notifyClipboard("No image on clipboard. Copy a screenshot or image first.");
          return false;
        }

        attachedImages.push(image);
        resetSelection();
        cursorVisible = true;
        process.stderr.write("\x1b[2mImage attached (backspace to remove)\x1b[0m\n");
        render();
        return true;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to read clipboard image.";
        notifyClipboard(message);
        return false;
      }
    }

    function finishBracketedPaste(pasted: string) {
      inBracketedPaste = false;
      pasteBuffer = "";

      if (pasted.trim()) {
        value += pasted;
        resetSelection();
        cursorVisible = true;
        render();
        return;
      }

      queueClipboardAttach();
    }

    async function submit() {
      await waitForClipboardAttach();

      const suggestions = currentSuggestions();

      if (hasNavigated && suggestions.length > 0) {
        const suggestion = suggestions[selectedIndex] ?? suggestions[0];

        if (suggestion) {
          applySuggestion(suggestion, true);
          return;
        }
      }

      cleanup();
      resolve({
        text: value,
        images: attachedImages.length > 0 ? attachedImages : undefined,
      });
    }

    function cancel() {
      cleanup();
      reject(new PromptCancelledError());
    }

    function onData(chunk: Buffer | string) {
      const key = String(chunk);

      if (inBracketedPaste) {
        pasteBuffer += key;

        const endIndex = pasteBuffer.indexOf(BRACKETED_PASTE_END);

        if (endIndex >= 0) {
          const pasted = pasteBuffer.slice(0, endIndex);
          finishBracketedPaste(pasted);
        }

        return;
      }

      if (key.includes(BRACKETED_PASTE_START)) {
        const startIndex = key.indexOf(BRACKETED_PASTE_START);
        const before = key.slice(0, startIndex);

        if (before) {
          value += before;
        }

        inBracketedPaste = true;
        pasteBuffer = key.slice(startIndex + BRACKETED_PASTE_START.length);

        const endIndex = pasteBuffer.indexOf(BRACKETED_PASTE_END);

        if (endIndex >= 0) {
          const pasted = pasteBuffer.slice(0, endIndex);
          finishBracketedPaste(pasted);
        }

        return;
      }

      if (key === "\u0003") {
        cancel();
        return;
      }

      if (key === "\u0004" && value.length === 0) {
        cancel();
        return;
      }

      if (key === "\r" || key === "\n") {
        submit();
        return;
      }

      if (key === "\u001b[A") {
        const suggestions = currentSuggestions();

        if (suggestions.length > 0) {
          hasNavigated = true;
          selectedIndex = (selectedIndex - 1 + suggestions.length) % suggestions.length;
          render();
        }

        return;
      }

      if (key === "\u001b[B") {
        const suggestions = currentSuggestions();

        if (suggestions.length > 0) {
          hasNavigated = true;
          selectedIndex = (selectedIndex + 1) % suggestions.length;
          render();
        }

        return;
      }

      if (key === "\t") {
        const suggestions = currentSuggestions();
        const suggestion = suggestions[selectedIndex] ?? suggestions[0];

        if (suggestion) {
          applySuggestion(suggestion);
        }

        return;
      }

      if (key === "\u0016") {
        queueClipboardAttach();
        return;
      }

      if (key === "\u007f" || key === "\b") {
        if (value.length > 0) {
          value = value.slice(0, -1);
        } else if (attachedImages.length > 0) {
          attachedImages.pop();
        }

        resetSelection();
        cursorVisible = true;
        render();
        return;
      }

      if (key.startsWith("\u001b")) {
        return;
      }

      if (key.length > 1) {
        const printable = [...key].filter((char) => char >= " " && char !== "\u007f").join("");

        if (!printable) {
          return;
        }

        value += printable;
        resetSelection();
        cursorVisible = true;
        render();
        return;
      }

      if (key.length === 1 && key >= " ") {
        value += key;
        resetSelection();
        cursorVisible = true;
        render();
      }
    }

    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");
    stdout.write("\x1b[?25l");
    stdin.on("data", onData);
    render();
  });
}

async function promptLineFallback(prefix: string): Promise<PromptLineResult> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    return { text: (await rl.question(prefix)).trimEnd() };
  } finally {
    rl.close();
  }
}

export async function promptSecret(prefix = "API key: "): Promise<string> {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    return (await promptLineFallback(prefix)).text;
  }

  return new Promise((resolve, reject) => {
    const stdin = process.stdin;
    const stdout = process.stdout;
    let value = "";
    let cursorVisible = true;
    let closed = false;

    const blinkTimer = setInterval(() => {
      cursorVisible = !cursorVisible;
      render();
    }, BLINK_INTERVAL_MS);

    function render() {
      const masked = "*".repeat(value.length);
      const cursor = cursorVisible ? CURSOR_CHAR : " ";
      stdout.write(`\r\x1b[K${prefix}${masked}${cursor}`);
    }

    function cleanup() {
      if (closed) {
        return;
      }

      closed = true;
      clearInterval(blinkTimer);
      stdin.setRawMode(false);
      stdin.off("data", onData);
      stdout.write("\x1b[?25h");
      stdout.write(`\r\x1b[K${prefix}${"*".repeat(value.length)}\n`);
    }

    function submit() {
      cleanup();
      resolve(value);
    }

    function cancel() {
      cleanup();
      reject(new PromptCancelledError());
    }

    function onData(chunk: Buffer | string) {
      const key = String(chunk);

      if (key === "\u0003") {
        cancel();
        return;
      }

      if (key === "\u0004" && value.length === 0) {
        cancel();
        return;
      }

      if (key === "\r" || key === "\n") {
        submit();
        return;
      }

      if (key === "\u007f" || key === "\b") {
        value = value.slice(0, -1);
        cursorVisible = true;
        render();
        return;
      }

      if (key.startsWith("\u001b")) {
        return;
      }

      if (key.length > 1) {
        const printable = [...key].filter((char) => char >= " " && char !== "\u007f").join("");

        if (!printable) {
          return;
        }

        value += printable;
        cursorVisible = true;
        render();
        return;
      }

      if (key.length === 1 && key >= " ") {
        value += key;
        cursorVisible = true;
        render();
      }
    }

    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");
    stdout.write("\x1b[?25l");
    stdin.on("data", onData);
    render();
  });
}
