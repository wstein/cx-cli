import {
  getCLIOverrides,
  readEnvOverrides,
  type CxEnvOverrides,
} from "../../config/env.js";
import { DEFAULT_BEHAVIOR_VALUES, DEFAULT_CONFIG_VALUES } from "../../config/defaults.js";
import { loadCxConfig } from "../../config/load.js";
import type {
  CxConfigDuplicateEntryMode,
  CxDedupMode,
  CxRepomixMissingExtensionMode,
} from "../../config/types.js";
import { asError, CxError } from "../../shared/errors.js";
import { pathExists } from "../../shared/fs.js";

type SettingSource =
  | "compiled default"
  | "cx.toml"
  | "env var"
  | "CX_STRICT"
  | "cli flag";

interface ResolvedSetting<T> {
  value: T;
  source: SettingSource;
}

interface EffectiveSettings {
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

/**
 * Determine whether the env overrides came from CX_STRICT (convenience
 * shorthand) rather than individual CX_* vars.
 */
function isEnvStrict(): boolean {
  const raw = process.env.CX_STRICT;
  return raw === "true" || raw === "1";
}

function resolveSource<T>(params: {
  cliValue: T | undefined;
  envValue: T | undefined;
  fileValue: T | undefined;
  defaultValue: T;
  envIsStrict: boolean;
}): ResolvedSetting<T> {
  const { cliValue, envValue, fileValue, defaultValue, envIsStrict } = params;

  if (cliValue !== undefined) {
    return { value: cliValue, source: "cli flag" };
  }

  if (envValue !== undefined) {
    return { value: envValue, source: envIsStrict ? "CX_STRICT" : "env var" };
  }

  if (fileValue !== undefined) {
    return { value: fileValue, source: "cx.toml" };
  }

  return { value: defaultValue, source: "compiled default" };
}

/**
 * Determine whether the `--strict` or `--lenient` CLI flag is active.
 * We infer this from the CLI overrides: --strict sets all to "fail",
 * --lenient sets all to "warn".
 */
function cliMode(cliOverrides: CxEnvOverrides): "--strict" | "--lenient" | null {
  const { dedupMode, repomixMissingExtension, configDuplicateEntry } =
    cliOverrides;

  if (
    dedupMode === "fail" &&
    repomixMissingExtension === "fail" &&
    configDuplicateEntry === "fail"
  ) {
    return "--strict";
  }

  if (
    dedupMode === "warn" &&
    repomixMissingExtension === "warn" &&
    configDuplicateEntry === "warn"
  ) {
    return "--lenient";
  }

  return null;
}

export async function runConfigCommand(options: {
  config: string;
  json: boolean;
}): Promise<number> {
  const configExists = await pathExists(options.config);
  const cliOverrides = getCLIOverrides();
  const envOverrides = readEnvOverrides();
  const envStrict = isEnvStrict();
  const activeCLIMode = cliMode(cliOverrides);

  let dedupModeFromFile: CxDedupMode | undefined;
  let repomixMissingExtensionFromFile: CxRepomixMissingExtensionMode | undefined;
  let configDuplicateEntryFromFile: CxConfigDuplicateEntryMode | undefined;

  if (configExists) {
    try {
      // Load the config with no overrides at all to isolate the raw file values.
      const loaded = await loadCxConfig(options.config, {}, {});
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

  const effective: EffectiveSettings = {
    dedup: {
      mode: resolveSource({
        cliValue: cliOverrides.dedupMode,
        envValue: envOverrides.dedupMode,
        fileValue: dedupModeFromFile,
        defaultValue: DEFAULT_CONFIG_VALUES.dedup.mode,
        envIsStrict: envStrict,
      }),
    },
    repomix: {
      missingExtension: resolveSource({
        cliValue: cliOverrides.repomixMissingExtension,
        envValue: envOverrides.repomixMissingExtension,
        fileValue: repomixMissingExtensionFromFile,
        defaultValue: DEFAULT_BEHAVIOR_VALUES.repomixMissingExtension,
        envIsStrict: envStrict,
      }),
    },
    config: {
      duplicateEntry: resolveSource({
        cliValue: cliOverrides.configDuplicateEntry,
        envValue: envOverrides.configDuplicateEntry,
        fileValue: configDuplicateEntryFromFile,
        defaultValue: DEFAULT_BEHAVIOR_VALUES.configDuplicateEntry,
        envIsStrict: envStrict,
      }),
    },
  };

  if (options.json) {
    process.stdout.write(
      JSON.stringify(
        {
          configFile: configExists ? options.config : null,
          cxStrict: envStrict,
          cliMode: activeCLIMode,
          settings: {
            "dedup.mode": effective.dedup.mode,
            "repomix.missing_extension": effective.repomix.missingExtension,
            "config.duplicate_entry": effective.config.duplicateEntry,
          },
        },
        null,
        2,
      ) + "\n",
    );
    return 0;
  }

  const configLabel = configExists ? options.config : "(not found)";
  process.stdout.write(`Effective behavioral settings\n`);
  process.stdout.write(`Config file : ${configLabel}\n`);
  process.stdout.write(`CX_STRICT   : ${envStrict ? "true" : "false"}\n`);
  if (activeCLIMode !== null) {
    process.stdout.write(`CLI mode    : ${activeCLIMode}\n`);
  }
  process.stdout.write(`\n`);

  const rows: Array<[string, string, string]> = [
    ["dedup.mode", effective.dedup.mode.value, effective.dedup.mode.source],
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
