import { describe, expect, test } from "bun:test";
import {
  customModelsToCatalog,
  isCompatibleModelId,
  resolveCompatibleDefaultModel,
} from "./compatible-models";

describe("compatible-models", () => {
  test("maps custom entries to catalog options", () => {
    const catalog = customModelsToCatalog([
      { id: "llama3.2", name: "Llama 3.2", default: true },
    ]);

    expect(catalog[0]).toMatchObject({
      id: "llama3.2",
      provider: "openai_compatible",
      default: true,
    });
  });

  test("resolves default model from custom list", () => {
    expect(
      resolveCompatibleDefaultModel([
        { id: "a" },
        { id: "b", default: true },
      ]),
    ).toBe("b");
  });

  test("checks compatible model membership", () => {
    expect(isCompatibleModelId("llama3.2", [{ id: "llama3.2" }])).toBe(true);
    expect(isCompatibleModelId("other", [{ id: "llama3.2" }])).toBe(false);
  });
});
