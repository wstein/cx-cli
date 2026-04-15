import { describe, expect, test } from "bun:test";

import {
  DEFAULT_LIST_DISPLAY_CONFIG,
  expectTimePalette,
  validateListDisplayConfig,
} from "../../src/config/display.js";

describe("config display validation", () => {
  test("expectTimePalette returns a copy of valid default palette", () => {
    const palette = expectTimePalette(
      [255, 254, 253, 252, 251, 250, 249, 248],
      "display.list.time_palette",
      DEFAULT_LIST_DISPLAY_CONFIG.timePalette,
    );
    expect(palette).toEqual([255, 254, 253, 252, 251, 250, 249, 248]);
    expect(palette).not.toBe(DEFAULT_LIST_DISPLAY_CONFIG.timePalette);
  });

  test("expectTimePalette rejects non-array values", () => {
    expect(() =>
      expectTimePalette(
        123 as any,
        "display.list.time_palette",
        DEFAULT_LIST_DISPLAY_CONFIG.timePalette,
      ),
    ).toThrow("display.list.time_palette must be an array of ANSI grayscale color codes.");
  });

  test("expectTimePalette rejects invalid palette lengths", () => {
    expect(() =>
      expectTimePalette(
        [255, 254, 253],
        "display.list.time_palette",
        DEFAULT_LIST_DISPLAY_CONFIG.timePalette,
      ),
    ).toThrow("display.list.time_palette must contain between 8 and 10 grayscale entries.");
  });

  test("validateListDisplayConfig accepts a valid config", () => {
    expect(() =>
      validateListDisplayConfig({
        bytesWarm: 1024,
        bytesHot: 8192,
        tokensWarm: 128,
        tokensHot: 512,
        mtimeWarmMinutes: 30,
        mtimeHotHours: 24,
        timePalette: DEFAULT_LIST_DISPLAY_CONFIG.timePalette,
      }),
    ).not.toThrow();
  });

  test("validateListDisplayConfig rejects invalid thresholds", () => {
    expect(() =>
      validateListDisplayConfig({
        bytesWarm: 8192,
        bytesHot: 1024,
        tokensWarm: 128,
        tokensHot: 64,
        mtimeWarmMinutes: 60,
        mtimeHotHours: 30,
        timePalette: DEFAULT_LIST_DISPLAY_CONFIG.timePalette,
      }),
    ).toThrow("display.list.bytes_hot must be greater than display.list.bytes_warm.");
  });
});