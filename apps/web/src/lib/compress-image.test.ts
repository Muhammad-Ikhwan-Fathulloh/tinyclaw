import { describe, expect, test } from "bun:test";
import { scaleImageDimensions } from "./compress-image";

describe("scaleImageDimensions", () => {
  test("keeps dimensions when already within bounds", () => {
    expect(scaleImageDimensions(800, 600, 2048)).toEqual({ width: 800, height: 600 });
  });

  test("scales down to max dimension", () => {
    expect(scaleImageDimensions(4096, 2048, 2048)).toEqual({ width: 2048, height: 1024 });
  });

  test("applies additional scale factor", () => {
    expect(scaleImageDimensions(1600, 1200, 2048, 0.5)).toEqual({ width: 800, height: 600 });
  });
});
