import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { resolveSkillDiscoveryDirs } from "./paths";

describe("skill paths", () => {
  let configDir: string | undefined;

  afterEach(() => {
    delete process.env.TINYCLAW_CONFIG_DIR;
    configDir = undefined;
  });

  test("resolveSkillDiscoveryDirs defaults to ~/.tinyclaw/agent/skills", async () => {
    configDir = await mkdtemp(path.join(tmpdir(), "tinyclaw-paths-test-"));
    process.env.TINYCLAW_CONFIG_DIR = configDir;

    await expect(resolveSkillDiscoveryDirs()).resolves.toEqual([
      path.join(configDir, "agent", "skills"),
    ]);
  });

  test("resolveSkillDiscoveryDirs includes profile skills dir", async () => {
    configDir = await mkdtemp(path.join(tmpdir(), "tinyclaw-paths-test-"));
    process.env.TINYCLAW_CONFIG_DIR = configDir;

    await expect(resolveSkillDiscoveryDirs({ profileId: "default" })).resolves.toEqual([
      path.join(configDir, "agent", "skills"),
      path.join(configDir, "profiles", "default", "skills"),
    ]);
  });

  test("resolveSkillDiscoveryDirs scans all profile skill dirs when no profileId", async () => {
    configDir = await mkdtemp(path.join(tmpdir(), "tinyclaw-paths-test-"));
    process.env.TINYCLAW_CONFIG_DIR = configDir;
    await mkdir(path.join(configDir, "profiles", "profile_a", "skills"), { recursive: true });
    await mkdir(path.join(configDir, "profiles", "profile_b", "skills"), { recursive: true });

    await expect(resolveSkillDiscoveryDirs()).resolves.toEqual([
      path.join(configDir, "agent", "skills"),
      path.join(configDir, "profiles", "profile_a", "skills"),
      path.join(configDir, "profiles", "profile_b", "skills"),
    ]);
  });
});
