import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { parse as parseToml } from "smol-toml";

import { CxError } from "../shared/errors.js";
import { pathExists } from "../shared/fs.js";
import { DEFAULT_USER_CONFIG_VALUES } from "./defaults.js";
import { expectTimePalette, validateListDisplayConfig } from "./display.js";
import type {
  CxListDisplayConfig,
  CxUserConfig,
  CxUserConfigInput,
} from "./types.js";

function expectPositiveInteger(
  value: unknown,
  label: string,
  defaultValue: number,
): number {
  if (value === undefined) {
    return defaultValue;
  }

  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    throw new CxError(`${label} must be a positive integer.`);
  }

  return value;
}

export function getUserConfigPath(): string {
  const configHome =
    process.env.XDG_CONFIG_HOME || path.join(os.homedir(), ".config");
  return path.join(configHome, "cx", "cx.toml");
}

function parseListDisplayConfig(
  raw: Record<string, unknown>,
): CxListDisplayConfig {
  const defaults = DEFAULT_USER_CONFIG_VALUES.display.list;
  const config: CxListDisplayConfig = {
    bytesWarm: expectPositiveInteger(
      raw.bytes_warm,
      "display.list.bytes_warm",
      defaults.bytesWarm,
    ),
    bytesHot: expectPositiveInteger(
      raw.bytes_hot,
      "display.list.bytes_hot",
      defaults.bytesHot,
    ),
    tokensWarm: expectPositiveInteger(
      raw.tokens_warm,
      "display.list.tokens_warm",
      defaults.tokensWarm,
    ),
    tokensHot: expectPositiveInteger(
      raw.tokens_hot,
      "display.list.tokens_hot",
      defaults.tokensHot,
    ),
    mtimeWarmMinutes: expectPositiveInteger(
      raw.mtime_warm_minutes,
      "display.list.mtime_warm_minutes",
      defaults.mtimeWarmMinutes,
    ),
    mtimeHotHours: expectPositiveInteger(
      raw.mtime_hot_hours,
      "display.list.mtime_hot_hours",
      defaults.mtimeHotHours,
    ),
    timePalette: expectTimePalette(
      raw.time_palette,
      "display.list.time_palette",
      defaults.timePalette,
    ),
  };

  validateListDisplayConfig(config);
  return config;
}

export async function loadCxUserConfig(
  configPath = getUserConfigPath(),
): Promise<CxUserConfig> {
  if (!(await pathExists(configPath))) {
    return {
      display: {
        list: {
          ...DEFAULT_USER_CONFIG_VALUES.display.list,
          timePalette: [...DEFAULT_USER_CONFIG_VALUES.display.list.timePalette],
        },
      },
    };
  }

  const raw = await fs.readFile(configPath, "utf8");
  const parsed = parseToml(raw) as CxUserConfigInput;
  const display = parsed.display ?? {};
  const displayList =
    typeof display.list === "object" && display.list !== null
      ? (display.list as Record<string, unknown>)
      : {};

  return {
    display: {
      list: parseListDisplayConfig(displayList),
    },
  };
}
