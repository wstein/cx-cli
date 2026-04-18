import fs from "node:fs/promises";
import { parse as parseToml } from "smol-toml";
import {
  DEFAULT_BEHAVIOR_VALUES,
  DEFAULT_CONFIG_VALUES,
} from "../../config/defaults.js";
import {
  type CxEnvOverrides,
  getCLIOverrides,
  readEnvOverrides,
} from "../../config/env.js";
import type {
  CxConfigDuplicateEntryMode,
  CxDedupMode,
  CxRepomixMissingExtensionMode,
} from "../../config/types.js";
import { asError, CxError } from "../../shared/errors.js";
import { pathExists } from "../../shared/fs.js";
import {
  type CommandIo,
  resolveCommandIo,
  writeStderr,
  writeStdout,
  writeValidatedJson,
} from "../../shared/output.js";
import {
  ConfigCommandErrorJsonSchema,
  ConfigCommandJsonSchema,
} from "../jsonContracts.js";

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

const VALID_DEDUP_MODES = new Set<CxDedupMode>(["fail", "warn", "first-wins"]);
const VALID_REPOMIX_MISSING = new Set<CxRepomixMissingExtensionMode>([
  "fail",
  "warn",
]);
const VALID_CONFIG_DUPLICATE = new Set<CxConfigDuplicateEntryMode>([
  "fail",
  "warn",
  "first-wins",
]);

function expectEnum<T extends string>(
  value: unknown,
  label: string,
  validValues: Set<T>,
): T {
  if (typeof value !== "string" || !validValues.has(value as T)) {
    throw new CxError(
      `${label} must be one of: ${[...validValues].join(", ")}.`,
    );
  }

  return value as T;
}

async function getConfigFileBehaviorValues(configPath: string): Promise<{
  dedupMode?: CxDedupMode;
  repomixMissingExtension?: CxRepomixMissingExtensionMode;
  configDuplicateEntry?: CxConfigDuplicateEntryMode;
}> {
  const raw = await fs.readFile(configPath, "utf8");
  const parsed = parseToml(raw) as Record<string, unknown>;
  const result: {
    dedupMode?: CxDedupMode;
    repomixMissingExtension?: CxRepomixMissingExtensionMode;
    configDuplicateEntry?: CxConfigDuplicateEntryMode;
  } = {};

  const dedup = parsed?.dedup as Record<string, unknown> | undefined;
  if (dedup?.mode !== undefined) {
    result.dedupMode = expectEnum(dedup.mode, "dedup.mode", VALID_DEDUP_MODES);
  }

  const repomix = parsed?.repomix as Record<string, unknown> | undefined;
  if (repomix?.missing_extension !== undefined) {
    result.repomixMissingExtension = expectEnum(
      repomix.missing_extension,
      "repomix.missing_extension",
      VALID_REPOMIX_MISSING,
    );
  }

  const configSection = parsed?.config as Record<string, unknown> | undefined;
  if (configSection?.duplicate_entry !== undefined) {
    result.configDuplicateEntry = expectEnum(
      configSection.duplicate_entry,
      "config.duplicate_entry",
      VALID_CONFIG_DUPLICATE,
    );
  }

  return result;
}

/**
 * Determine whether the env overrides came from CX_STRICT (convenience
 * shorthand) rather than individual CX_* vars.
 */
function isEnvStrict(env: NodeJS.ProcessEnv): boolean {
  const raw = env.CX_STRICT;
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
function cliMode(
  cliOverrides: CxEnvOverrides,
): "--strict" | "--lenient" | null {
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

export async function runConfigCommand(
  options: {
    config: string;
    json: boolean;
  },
  ioArg: Partial<CommandIo> = {},
): Promise<number> {
  const io = resolveCommandIo(ioArg);
  const configExists = await pathExists(options.config);
  const cliOverrides = getCLIOverrides();
  const envOverrides = readEnvOverrides(io.env);
  const envStrict = isEnvStrict(io.env);
  const activeCLIMode = cliMode(cliOverrides);

  let dedupModeFromFile: CxDedupMode | undefined;
  let repomixMissingExtensionFromFile:
    | CxRepomixMissingExtensionMode
    | undefined;
  let configDuplicateEntryFromFile: CxConfigDuplicateEntryMode | undefined;

  if (configExists) {
    try {
      const values = await getConfigFileBehaviorValues(options.config);
      dedupModeFromFile = values.dedupMode;
      repomixMissingExtensionFromFile = values.repomixMissingExtension;
      configDuplicateEntryFromFile = values.configDuplicateEntry;
    } catch (error: unknown) {
      if (options.json) {
        writeValidatedJson(
          ConfigCommandErrorJsonSchema,
          { error: asError(error).message },
          io,
        );
      } else {
        writeStderr(`Error: ${asError(error).message}\n`, io);
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

  // Emit warnings when env vars or CLI flags override explicit cx.toml values.
  // Matches the format used by resolveCategory() in config/load.ts.
  const shadowChecks: Array<{
    key: string;
    setting: ResolvedSetting<string>;
    fileValue: string | undefined;
  }> = [
    {
      key: "dedup.mode",
      setting: effective.dedup.mode as ResolvedSetting<string>,
      fileValue: dedupModeFromFile,
    },
    {
      key: "repomix.missing_extension",
      setting: effective.repomix.missingExtension as ResolvedSetting<string>,
      fileValue: repomixMissingExtensionFromFile,
    },
    {
      key: "config.duplicate_entry",
      setting: effective.config.duplicateEntry as ResolvedSetting<string>,
      fileValue: configDuplicateEntryFromFile,
    },
  ];
  for (const { key, setting, fileValue } of shadowChecks) {
    if (
      (setting.source === "env var" ||
        setting.source === "CX_STRICT" ||
        setting.source === "cli flag") &&
      fileValue !== undefined &&
      fileValue !== setting.value
    ) {
      writeStderr(
        `Warning: ${key} in cx.toml ("${fileValue}") is overridden by ${setting.source} to "${setting.value}"\n`,
        io,
      );
    }
  }

  if (options.json) {
    writeValidatedJson(
      ConfigCommandJsonSchema,
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
      io,
    );
    return 0;
  }

  const configLabel = configExists ? options.config : "(not found)";
  writeStdout(`Effective behavioral settings\n`, io);
  writeStdout(`Config file : ${configLabel}\n`, io);
  writeStdout(`CX_STRICT   : ${envStrict ? "true" : "false"}\n`, io);
  if (activeCLIMode !== null) {
    writeStdout(`CLI mode    : ${activeCLIMode}\n`, io);
  }
  writeStdout(`\n`, io);

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

  writeStdout(
    `${"Setting".padEnd(col0)}  ${"Value".padEnd(col1)}  Source\n`,
    io,
  );
  writeStdout(
    `${"-".repeat(col0)}  ${"-".repeat(col1)}  ${"-".repeat(16)}\n`,
    io,
  );
  for (const [key, value, source] of rows) {
    writeStdout(`${key.padEnd(col0)}  ${value.padEnd(col1)}  ${source}\n`, io);
  }

  writeStdout(`\n`, io);
  writeStdout(
    `Category A invariants (section overlap when dedup.mode=fail, asset\n` +
      `collision, missing core adapter contract) are never configurable.\n`,
    io,
  );

  return 0;
}
