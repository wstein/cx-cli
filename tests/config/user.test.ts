// test-lane: integration

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, test } from "vitest";

import { loadCxUserConfig } from "../../src/config/user.js";

describe("loadCxUserConfig", () => {
  test("returns defaults when the user config file is missing on disk", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "cx-user-config-"));
    const configPath = path.join(tempDir, "cx.toml");

    const config = await loadCxUserConfig(configPath);
    expect(config.display.list.bytesWarm).toBe(4096);
    expect(config.display.list.tokensHot).toBe(2048);
    expect(config.display.list.timePalette).toEqual([
      255, 254, 253, 252, 251, 250, 249, 248, 247, 246,
    ]);
  });

  test("loads display settings from a real user config file", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "cx-user-config-"));
    const configPath = path.join(tempDir, "cx.toml");

    await fs.writeFile(
      configPath,
      `[display.list]
bytes_warm = 2048
bytes_hot = 32768
tokens_warm = 256
tokens_hot = 1024
mtime_warm_minutes = 30
mtime_hot_hours = 12
time_palette = [255, 254, 253, 252, 251, 250, 249, 248]
`,
      "utf8",
    );

    const config = await loadCxUserConfig(configPath);
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
});
