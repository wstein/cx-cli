// test-lane: unit
import { describe, expect, test } from "bun:test";
import {
  loadCxUserConfigFromTomlString,
  parseCxUserConfigInput,
} from "../../src/config/user.js";

describe("parseCxUserConfigInput", () => {
  test("returns defaults when no input is provided", () => {
    const config = parseCxUserConfigInput(undefined);
    expect(config.display.list.bytesWarm).toBe(4096);
    expect(config.display.list.tokensHot).toBe(2048);
    expect(config.display.list.timePalette).toEqual([
      255, 254, 253, 252, 251, 250, 249, 248, 247, 246,
    ]);
  });
});

describe("loadCxUserConfigFromTomlString", () => {
  test("parses display settings from TOML", () => {
    const config = loadCxUserConfigFromTomlString(`[display.list]
bytes_warm = 2048
bytes_hot = 32768
tokens_warm = 256
tokens_hot = 1024
mtime_warm_minutes = 30
mtime_hot_hours = 12
time_palette = [255, 254, 253, 252, 251, 250, 249, 248]
`);

    expect(config.display.list.bytesWarm).toBe(2048);
    expect(config.display.list.bytesHot).toBe(32768);
    expect(config.display.list.tokensWarm).toBe(256);
    expect(config.display.list.tokensHot).toBe(1024);
    expect(config.display.list.mtimeWarmMinutes).toBe(30);
    expect(config.display.list.mtimeHotHours).toBe(12);
    expect(config.display.list.timePalette).toEqual([
      255, 254, 253, 252, 251, 250, 249, 248,
    ]);
  });

  test("rejects invalid time palette shape", () => {
    expect(() =>
      loadCxUserConfigFromTomlString(`[display.list]
time_palette = [255, 255, 254]
`),
    ).toThrow(
      "display.list.time_palette must contain between 8 and 10 grayscale entries.",
    );
  });

  test("rejects invalid threshold ordering", () => {
    expect(() =>
      loadCxUserConfigFromTomlString(`[display.list]
bytes_warm = 4096
bytes_hot = 4096
`),
    ).toThrow(
      "display.list.bytes_hot must be greater than display.list.bytes_warm.",
    );
  });
});
