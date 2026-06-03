import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { getUserConfigPath, loadUserConfig, saveUserConfig } from "./user-config";

describe("user config compatible provider", () => {
  let configDir = "";

  afterEach(async () => {
    if (configDir) {
      await rm(configDir, { recursive: true, force: true });
      configDir = "";
    }

    delete process.env.TINYCLAW_CONFIG_DIR;
  });

  test("round-trips display_name, base_url, and models_json", async () => {
    configDir = await mkdtemp(join(tmpdir(), "tinyclaw-config-"));
    process.env.TINYCLAW_CONFIG_DIR = configDir;

    await saveUserConfig({
      provider: "openai_compatible",
      apiKey: "local-key",
      displayName: "Ollama",
      baseUrl: "http://localhost:11434/v1/",
      customModels: [
        {
          id: "llama3.2",
          name: "Llama 3.2",
          default: true,
          inputPerMillionUsd: 0,
          outputPerMillionUsd: 0,
        },
      ],
      model: "llama3.2",
    });

    const raw = await readFile(getUserConfigPath(), "utf8");
    expect(raw).toContain("display_name=Ollama");
    expect(raw).toContain("base_url=http://localhost:11434/v1");
    expect(raw).toContain("models_json=");

    const loaded = await loadUserConfig();
    expect(loaded?.provider).toBe("openai_compatible");
    expect(loaded?.displayName).toBe("Ollama");
    expect(loaded?.baseUrl).toBe("http://localhost:11434/v1");
    expect(loaded?.customModels?.[0]?.id).toBe("llama3.2");
  });

  test("round-trips base_url for native providers", async () => {
    configDir = await mkdtemp(join(tmpdir(), "tinyclaw-config-"));
    process.env.TINYCLAW_CONFIG_DIR = configDir;

    await saveUserConfig({
      provider: "anthropic",
      apiKey: "kimi-key",
      baseUrl: "https://api.kimi.com/coding/v1",
      model: "claude-sonnet-4-6",
    });

    const loaded = await loadUserConfig();
    expect(loaded?.provider).toBe("anthropic");
    expect(loaded?.baseUrl).toBe("https://api.kimi.com/coding/v1");
  });
});
