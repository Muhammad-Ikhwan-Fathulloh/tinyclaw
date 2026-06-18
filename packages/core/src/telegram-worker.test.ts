import { describe, expect, test } from "bun:test";
import {
  isHeartbeatAlive,
  isProcessAlive,
  parseTelegramWorkerHeartbeat,
  resolveTelegramWorkerStatus,
} from "./telegram-worker";

describe("resolveTelegramWorkerStatus", () => {
  test("is ok when telegram is not configured", () => {
    expect(
      resolveTelegramWorkerStatus(
        {
          configured: false,
          botTokenMasked: null,
          handshakeCode: null,
          pairedUserIds: [],
          allowedUserIds: [],
          profileId: "default",
        },
        false,
      ),
    ).toEqual({
      ok: true,
      configured: false,
      paired: false,
      running: false,
    });
  });

  test("requires a running worker when configured", () => {
    expect(
      resolveTelegramWorkerStatus(
        {
          configured: true,
          botTokenMasked: "••••1234",
          handshakeCode: "ABCD",
          pairedUserIds: [],
          allowedUserIds: [],
          profileId: "default",
        },
        false,
      ),
    ).toEqual({
      ok: false,
      configured: true,
      paired: false,
      running: false,
    });

    expect(
      resolveTelegramWorkerStatus(
        {
          configured: true,
          botTokenMasked: "••••1234",
          handshakeCode: null,
          pairedUserIds: [42],
          allowedUserIds: [],
          profileId: "default",
        },
        true,
      ),
    ).toEqual({
      ok: true,
      configured: true,
      paired: true,
      running: true,
    });
  });
});

describe("isHeartbeatAlive", () => {
  test("rejects stale or invalid heartbeats", () => {
    expect(isHeartbeatAlive(null)).toBe(false);
    expect(
      isHeartbeatAlive({
        pid: process.pid,
        updatedAt: new Date(Date.now() - 60_000).toISOString(),
      }),
    ).toBe(false);
    expect(
      isHeartbeatAlive({
        pid: process.pid,
        updatedAt: "not-a-date",
      }),
    ).toBe(false);
  });

  test("accepts a fresh heartbeat for the current process", () => {
    expect(
      isHeartbeatAlive({
        pid: process.pid,
        updatedAt: new Date().toISOString(),
      }),
    ).toBe(true);
  });
});

describe("parseTelegramWorkerHeartbeat", () => {
  test("parses valid JSON", () => {
    expect(
      parseTelegramWorkerHeartbeat(
        JSON.stringify({ pid: 12, updatedAt: "2026-01-01T00:00:00.000Z" }),
      ),
    ).toEqual({ pid: 12, updatedAt: "2026-01-01T00:00:00.000Z" });
  });

  test("returns null for invalid payloads", () => {
    expect(parseTelegramWorkerHeartbeat("not json")).toBeNull();
    expect(parseTelegramWorkerHeartbeat("{}")).toBeNull();
  });
});

describe("isProcessAlive", () => {
  test("returns true for the current process", () => {
    expect(isProcessAlive(process.pid)).toBe(true);
  });

  test("returns false for invalid pids", () => {
    expect(isProcessAlive(-1)).toBe(false);
  });
});
