import type { Context } from "grammy";

const TYPING_REFRESH_MS = 4_000;

export interface TypingLoop {
  start(): void;
  ping(): void;
  stop(): void;
}

export function createTypingLoop(ctx: Context): TypingLoop {
  let interval: ReturnType<typeof setInterval> | null = null;

  async function sendTyping(): Promise<void> {
    try {
      await ctx.replyWithChatAction("typing");
    } catch {
      // Chat may have been deleted or bot blocked — ignore.
    }
  }

  return {
    start() {
      void sendTyping();
      interval = setInterval(() => {
        void sendTyping();
      }, TYPING_REFRESH_MS);
    },
    ping() {
      void sendTyping();
    },
    stop() {
      if (interval) {
        clearInterval(interval);
        interval = null;
      }
    },
  };
}
