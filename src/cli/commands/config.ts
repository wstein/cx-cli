import { loadCxConfig } from "../../config/load.js";
import { readEnvOverrides } from "../../config/env.js";
import { DEFAULT_BEHAVIOR_VALUES, DEFAULT_CONFIG_VALUES } from "../../config/defaults.js";
import type {
  CxConfigDuplicateEntryMode,
  CxDedupMode,
  CxRepomixMissingExtensionMode,
} from "../../config/types.js";
import { asError, CxError } from "../../shared/errors.js";
import { pathExists } from "../../shared/fs.js";

type SettingSource = "compiled default" | "cx.toml" | "env var" | "CX_STRICT";

interface ResolvedSetting<T> {
  value: T;
  source: SettingSource;
}

interface EffectiveConfig {
  dedup: {
    mode: ResolvedSetting<CxDedupMode>;
  };
  repomix: {
    missingExtension: ResolvedSetting<CxRepomixMissingExtensionMode>;
  };
  config: {
    duplicateEntry: ResolvedSetting<CxConfigDuplicateEntryMode>;
  };
}

function resolveSource<T>(params: {
  envValue: T | undefined;
  fileValue: T | undefined;
  defaultValue: T;
  isStrict: boolean;
}): ResolvedSetting<T> {
  const { envValue, fileValue, defaultValue, isStrict } = params;

  if (envValue !== undefined) {
    return { value: envValue, source: isStrict ? "CX_STRICT" : "env var" };
  }

  if (fileValue !== undefined) {
    return { value: fileValue, source: "cx.toml" };
  }

  return { value: defaultValue, source: "compiled default" };
}

export async function runConfigCommand(options: {
  config: string;
  json: boolean;
}): Promise<number> {
  const configExists = await pathExists(options.config);
  const strict = process.env.CX_STRICT === "true" || process.env.CX_STRICT === "1";
  const envOverrides = readEnvOverrides();

  let dedupModeFromFile: CxDedupMode | undefined;
  let repomixMissingExtensionFromFile: CxRepomixMissingExtensionMode | undefined;
  let configDuplicateEntryFromFile: CxConfigDuplicateEntryMode | undefined;

  if (configExists) {
    try {
      // Load config to extract the raw file values for each Category B setting.
      // We use a no-override load to isolate the file values.
      const loaded = await loadCxConfig(options.config, {});
      dedupModeFromFile = loaded.dedup.mode;
      repomixMissingExtensionFromFile = loaded.behavior.repomixMissingExtension;
      configDuplicateEntryFromFile = loaded.behavior.configDuplicateEntry;
    } catch (error: unknown) {
      if (options.json) {
        process.stdout.write(
          JSON.stringify({ error: asError(error).message }, null, 2) + "\n",
        );
      } else {
        process.stderr.write(`Error: ${asError(error).message}\n`);
      }

      return error instanceof CxError ? error.exitCode : 1;
    }
  }

  const effective: EffectiveConfig = {
    dedup: {
      mode: resolveSource({
        envValue: envOverrides.dedupMode,
        fileValue: dedupModeFromFile,
        defaultValue: DEFAULT_CONFIG_VALUES.dedup.mode,
        isStrict: strict,
      }),
    },
    repomix: {
      missingExtension: resolveSource({
        envValue: envOverrides.repomixMissingExtension,
        fileValue: repomixMissingExtensionFromFile,
        defaultValue: DEFAULT_BEHAVIOR_VALUES.repomixMissingExtension,
        isStrict: strict,
      }),
    },
    config: {
      duplicateEntry: resolveSource({
        envValue: envOverrides.configDuplicateEntry,
        fileValue: configDuplicateEntryFromFile,
        defaultValue: DEFAULT_BEHAVIOR_VALUES.configDuplicateEntry,
        isStrict: strict,
      }),
    },
  };

  if (options.json) {
    const output = {
      configFile: configExists ? options.config : null,
      cxStrict: strict,
      settings: {
        "dedup.mode": effective.dedup.mode,
        "repomix.missing_extension": effective.repomix.missingExtension,
        "config.duplicate_entry": effective.config.duplicateEntry,
      },
    };
    process.stdout.write(JSON.stringify(output, null, 2) + "\n");
    return 0;
  }

  const configLabel = configExists ? options.config : "(not found)";
  process.stdout.write(`Effective behavioral settings\n`);
  process.stdout.write(`Config file : ${configLabel}\n`);
  process.stdout.write(`CX_STRICT   : ${strict ? "true" : "false"}\n`);
  process.stdout.write(`\n`);

  const rows: Array<[string, string, string]> = [
    [
      "dedup.mode",
      effective.dedup.mode.value,
      effective.dedup.mode.source,
    ],
    [
      "repomix.missing_extension",
      effective.repomix.missingExtension.value,
      effective.repomix.missingExtension.source,
    ],
    [
      "config.duplicate_entry",
      effective.config.duplicateEntry.value,
      effective.config.duplicateEntry.source,
    ],
  ];

  const col0 = Math.max(...rows.map(([k]) => k.length));
  const col1 = Math.max(...rows.map(([, v]) => v.length));

  process.stdout.write(
    `${"Setting".padEnd(col0)}  ${"Value".padEnd(col1)}  Source\n`,
  );
  process.stdout.write(
    `${"-".repeat(col0)}  ${"-".repeat(col1)}  ${"-".repeat(16)}\n`,
  );

  for (const [key, value, source] of rows) {
    process.stdout.write(
      `${key.padEnd(col0)}  ${value.padEnd(col1)}  ${source}\n`,
    );
  }

  process.stdout.write(`\n`);
  process.stdout.write(
    `Category A invariants (section overlap when dedup.mode=fail, asset\n` +
    `collision, missing core adapter contract) are never configurable.\n`,
  );

  return 0;
}
