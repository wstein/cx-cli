// test-lane: unit
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

  test("expectTimePalette returns a copy of the default palette when omitted", () => {
    const palette = expectTimePalette(
      undefined,
      "display.list.time_palette",
      DEFAULT_LIST_DISPLAY_CONFIG.timePalette,
    );

    expect(palette).toEqual(DEFAULT_LIST_DISPLAY_CONFIG.timePalette);
    expect(palette).not.toBe(DEFAULT_LIST_DISPLAY_CONFIG.timePalette);
  });

  test("expectTimePalette rejects non-array values", () => {
    expect(() =>
      expectTimePalette(
        123 as unknown as string[],
        "display.list.time_palette",
        DEFAULT_LIST_DISPLAY_CONFIG.timePalette,
      ),
    ).toThrow(
      "display.list.time_palette must be an array of ANSI grayscale color codes.",
    );
  });

  test("expectTimePalette rejects invalid palette lengths", () => {
    expect(() =>
      expectTimePalette(
        [255, 254, 253],
        "display.list.time_palette",
        DEFAULT_LIST_DISPLAY_CONFIG.timePalette,
      ),
    ).toThrow(
      "display.list.time_palette must contain between 8 and 10 grayscale entries.",
    );
  });

  test("expectTimePalette rejects non-integer palette entries", () => {
    expect(() =>
      expectTimePalette(
        [255, 254, 253, 252, 251, 250, 249, 248.5],
        "display.list.time_palette",
        DEFAULT_LIST_DISPLAY_CONFIG.timePalette,
      ),
    ).toThrow(
      "display.list.time_palette[7] must be an integer ANSI grayscale code between 232 and 255.",
    );
  });

  test("expectTimePalette rejects non-descending palettes", () => {
    expect(() =>
      expectTimePalette(
        [255, 254, 253, 252, 251, 250, 249, 249],
        "display.list.time_palette",
        DEFAULT_LIST_DISPLAY_CONFIG.timePalette,
      ),
    ).toThrow(
      "display.list.time_palette must descend from brighter to darker grayscale codes.",
    );
  });

  test("expectTimePalette rejects sparse palette arrays", () => {
    const sparsePalette = [255, 254, 253, 252, 251, 250, 249, 248] as number[];
    delete sparsePalette[3];

    expect(() =>
      expectTimePalette(
        sparsePalette,
        "display.list.time_palette",
        DEFAULT_LIST_DISPLAY_CONFIG.timePalette,
      ),
    ).toThrow(
      "display.list.time_palette contains an invalid grayscale palette entry.",
    );
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
    ).toThrow(
      "display.list.bytes_hot must be greater than display.list.bytes_warm.",
    );
  });

  test("validateListDisplayConfig rejects invalid token thresholds", () => {
    expect(() =>
      validateListDisplayConfig({
        bytesWarm: 1024,
        bytesHot: 8192,
        tokensWarm: 512,
        tokensHot: 512,
        mtimeWarmMinutes: 30,
        mtimeHotHours: 24,
        timePalette: DEFAULT_LIST_DISPLAY_CONFIG.timePalette,
      }),
    ).toThrow(
      "display.list.tokens_hot must be greater than display.list.tokens_warm.",
    );
  });

  test("validateListDisplayConfig rejects invalid mtime thresholds", () => {
    expect(() =>
      validateListDisplayConfig({
        bytesWarm: 1024,
        bytesHot: 8192,
        tokensWarm: 128,
        tokensHot: 512,
        mtimeWarmMinutes: 1800,
        mtimeHotHours: 24,
        timePalette: DEFAULT_LIST_DISPLAY_CONFIG.timePalette,
      }),
    ).toThrow(
      "display.list.mtime_hot_hours must represent a later threshold than display.list.mtime_warm_minutes.",
    );
  });
});
