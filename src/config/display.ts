import { CxError } from "../shared/errors.js";
import type { CxListDisplayConfig } from "./types.js";

export const DEFAULT_LIST_DISPLAY_CONFIG: CxListDisplayConfig = {
  bytesWarm: 4096,
  bytesHot: 65536,
  tokensWarm: 512,
  tokensHot: 2048,
  mtimeWarmMinutes: 60,
  mtimeHotHours: 24,
  timePalette: [255, 254, 253, 252, 251, 250, 249, 248, 247, 246],
};

export function expectTimePalette(
  value: unknown,
  label: string,
  defaultValue: number[],
): number[] {
  if (value === undefined) {
    return [...defaultValue];
  }

  if (!Array.isArray(value)) {
    throw new CxError(
      `${label} must be an array of ANSI grayscale color codes.`,
    );
  }

  if (value.length < 8 || value.length > 10) {
    throw new CxError(
      `${label} must contain between 8 and 10 grayscale entries.`,
    );
  }

  const palette = value.map((entry, index) => {
    if (
      typeof entry !== "number" ||
      !Number.isInteger(entry) ||
      entry < 232 ||
      entry > 255
    ) {
      throw new CxError(
        `${label}[${index}] must be an integer ANSI grayscale code between 232 and 255.`,
      );
    }
    return entry;
  });

  for (let index = 1; index < palette.length; index += 1) {
    const current = palette[index];
    const previous = palette[index - 1];
    if (current === undefined || previous === undefined) {
      throw new CxError(
        `${label} contains an invalid grayscale palette entry.`,
      );
    }
    if (current >= previous) {
      throw new CxError(
        `${label} must descend from brighter to darker grayscale codes.`,
      );
    }
  }

  return palette;
}

export function validateListDisplayConfig(
  config: CxListDisplayConfig,
  label = "display.list",
): void {
  if (config.bytesHot <= config.bytesWarm) {
    throw new CxError(
      `${label}.bytes_hot must be greater than ${label}.bytes_warm.`,
    );
  }
  if (config.tokensHot <= config.tokensWarm) {
    throw new CxError(
      `${label}.tokens_hot must be greater than ${label}.tokens_warm.`,
    );
  }
  if (config.mtimeHotHours * 60 <= config.mtimeWarmMinutes) {
    throw new CxError(
      `${label}.mtime_hot_hours must represent a later threshold than ${label}.mtime_warm_minutes.`,
    );
  }
}
