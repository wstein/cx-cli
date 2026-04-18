import { describe, test } from "bun:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import fc from "fast-check";

import { loadCxConfig } from "../../src/config/load.js";
import type {
  CxAssetsLayout,
  CxConfigDuplicateEntryMode,
  CxDedupMode,
  CxRepomixMissingExtensionMode,
} from "../../src/config/types.js";

const dedupModes: CxDedupMode[] = ["fail", "warn", "first-wins"];
const repomixMissingModes: CxRepomixMissingExtensionMode[] = ["fail", "warn"];
const duplicateModes: CxConfigDuplicateEntryMode[] = [
  "fail",
  "warn",
  "first-wins",
];
const assetLayouts: CxAssetsLayout[] = ["flat", "deep"];

const optionalDedupArb = fc.option(fc.constantFrom(...dedupModes), {
  nil: undefined,
});
const optionalRepomixMissingArb = fc.option(
  fc.constantFrom(...repomixMissingModes),
  { nil: undefined },
);
const optionalDuplicateArb = fc.option(fc.constantFrom(...duplicateModes), {
  nil: undefined,
});
const optionalAssetLayoutArb = fc.option(fc.constantFrom(...assetLayouts), {
  nil: undefined,
});

function buildConfigToml(fileSettings: {
  dedupMode: CxDedupMode | undefined;
  repomixMissingExtension: CxRepomixMissingExtensionMode | undefined;
  configDuplicateEntry: CxConfigDuplicateEntryMode | undefined;
  assetsLayout: CxAssetsLayout | undefined;
}): string {
  const lines = [
    "schema_version = 1",
    'project_name = "prop-test"',
    'source_root = "."',
    'output_dir = "dist/prop-test"',
    "",
  ];

  if (fileSettings.dedupMode !== undefined) {
    lines.push("[dedup]", `mode = "${fileSettings.dedupMode}"`, "");
  }
  if (fileSettings.repomixMissingExtension !== undefined) {
    lines.push(
      "[repomix]",
      `missing_extension = "${fileSettings.repomixMissingExtension}"`,
      "",
    );
  }
  if (fileSettings.configDuplicateEntry !== undefined) {
    lines.push(
      "[config]",
      `duplicate_entry = "${fileSettings.configDuplicateEntry}"`,
      "",
    );
  }
  if (fileSettings.assetsLayout !== undefined) {
    lines.push("[assets]", `layout = "${fileSettings.assetsLayout}"`, "");
  }

  lines.push("[sections.main]", 'include = ["src/**"]', "exclude = []", "");

  return lines.join("\n");
}

function expectedValue<T>(params: {
  cliValue: T | undefined;
  envValue: T | undefined;
  fileValue: T | undefined;
  defaultValue: T;
}): T {
  if (params.cliValue !== undefined) {
    return params.cliValue;
  }
  if (params.envValue !== undefined) {
    return params.envValue;
  }
  if (params.fileValue !== undefined) {
    return params.fileValue;
  }
  return params.defaultValue;
}

function expectedSource(params: {
  cliValue: unknown;
  envValue: unknown;
  fileValue: unknown;
  strictEnabled: boolean;
  strictCanApply: boolean;
}): "compiled default" | "cx.toml" | "env var" | "cli flag" | "CX_STRICT" {
  if (params.cliValue !== undefined) {
    return "cli flag";
  }
  if (params.envValue !== undefined) {
    if (params.strictEnabled && params.strictCanApply) {
      return "CX_STRICT";
    }
    return "env var";
  }
  if (params.fileValue !== undefined) {
    return "cx.toml";
  }
  return "compiled default";
}

describe("loadCxConfig property matrix", () => {
  test("resolves behavior precedence and sources under combinatorial conflicts", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "cx-load-prop-"));
    const configPath = path.join(root, "cx.toml");
    const originalStrict = process.env.CX_STRICT;

    try {
      await fc.assert(
        fc.asyncProperty(
          optionalDedupArb,
          optionalRepomixMissingArb,
          optionalDuplicateArb,
          optionalAssetLayoutArb,
          optionalDedupArb,
          optionalRepomixMissingArb,
          optionalDuplicateArb,
          optionalAssetLayoutArb,
          optionalDedupArb,
          optionalRepomixMissingArb,
          optionalDuplicateArb,
          optionalAssetLayoutArb,
          fc.boolean(),
          async (
            fileDedup,
            fileRepomixMissing,
            fileDuplicate,
            fileAssetLayout,
            envDedup,
            envRepomixMissing,
            envDuplicate,
            envAssetLayout,
            cliDedup,
            cliRepomixMissing,
            cliDuplicate,
            cliAssetLayout,
            strictEnabled,
          ) => {
            const effectiveEnvDedup =
              strictEnabled === true ? "fail" : envDedup;
            const effectiveEnvRepomixMissing =
              strictEnabled === true ? "fail" : envRepomixMissing;
            const effectiveEnvDuplicate =
              strictEnabled === true ? "fail" : envDuplicate;

            const envOverrides = {
              ...(effectiveEnvDedup !== undefined && {
                dedupMode: effectiveEnvDedup,
              }),
              ...(effectiveEnvRepomixMissing !== undefined && {
                repomixMissingExtension: effectiveEnvRepomixMissing,
              }),
              ...(effectiveEnvDuplicate !== undefined && {
                configDuplicateEntry: effectiveEnvDuplicate,
              }),
              ...(envAssetLayout !== undefined && {
                assetsLayout: envAssetLayout,
              }),
            };

            const cliOverrides = {
              ...(cliDedup !== undefined && { dedupMode: cliDedup }),
              ...(cliRepomixMissing !== undefined && {
                repomixMissingExtension: cliRepomixMissing,
              }),
              ...(cliDuplicate !== undefined && {
                configDuplicateEntry: cliDuplicate,
              }),
              ...(cliAssetLayout !== undefined && {
                assetsLayout: cliAssetLayout,
              }),
            };

            if (strictEnabled) {
              process.env.CX_STRICT = "true";
            } else {
              delete process.env.CX_STRICT;
            }

            await fs.writeFile(
              configPath,
              buildConfigToml({
                dedupMode: fileDedup,
                repomixMissingExtension: fileRepomixMissing,
                configDuplicateEntry: fileDuplicate,
                assetsLayout: fileAssetLayout,
              }),
              "utf8",
            );

            const loaded = await loadCxConfig(
              configPath,
              envOverrides,
              cliOverrides,
            );

            const expectedDedup = expectedValue({
              cliValue: cliDedup,
              envValue: effectiveEnvDedup,
              fileValue: fileDedup,
              defaultValue: "fail",
            });
            const expectedRepomixMissing = expectedValue({
              cliValue: cliRepomixMissing,
              envValue: effectiveEnvRepomixMissing,
              fileValue: fileRepomixMissing,
              defaultValue: "warn",
            });
            const expectedDuplicate = expectedValue({
              cliValue: cliDuplicate,
              envValue: effectiveEnvDuplicate,
              fileValue: fileDuplicate,
              defaultValue: "fail",
            });
            const expectedAssetsLayout = expectedValue({
              cliValue: cliAssetLayout,
              envValue: envAssetLayout,
              fileValue: fileAssetLayout,
              defaultValue: "flat",
            });

            if (loaded.dedup.mode !== expectedDedup) {
              throw new Error(
                `dedup.mode mismatch: expected ${expectedDedup}, got ${loaded.dedup.mode}`,
              );
            }
            if (
              loaded.behavior.repomixMissingExtension !== expectedRepomixMissing
            ) {
              throw new Error(
                `repomix.missing_extension mismatch: expected ${expectedRepomixMissing}, got ${loaded.behavior.repomixMissingExtension}`,
              );
            }
            if (loaded.behavior.configDuplicateEntry !== expectedDuplicate) {
              throw new Error(
                `config.duplicate_entry mismatch: expected ${expectedDuplicate}, got ${loaded.behavior.configDuplicateEntry}`,
              );
            }
            if (loaded.assets.layout !== expectedAssetsLayout) {
              throw new Error(
                `assets.layout mismatch: expected ${expectedAssetsLayout}, got ${loaded.assets.layout}`,
              );
            }

            const expectedDedupSource = expectedSource({
              cliValue: cliDedup,
              envValue: effectiveEnvDedup,
              fileValue: fileDedup,
              strictEnabled,
              strictCanApply: true,
            });
            const expectedRepomixSource = expectedSource({
              cliValue: cliRepomixMissing,
              envValue: effectiveEnvRepomixMissing,
              fileValue: fileRepomixMissing,
              strictEnabled,
              strictCanApply: true,
            });
            const expectedDuplicateSource = expectedSource({
              cliValue: cliDuplicate,
              envValue: effectiveEnvDuplicate,
              fileValue: fileDuplicate,
              strictEnabled,
              strictCanApply: true,
            });
            const expectedAssetsSource = expectedSource({
              cliValue: cliAssetLayout,
              envValue: envAssetLayout,
              fileValue: fileAssetLayout,
              strictEnabled,
              strictCanApply: false,
            });

            if (loaded.behaviorSources.dedupMode !== expectedDedupSource) {
              throw new Error(
                `dedup source mismatch: expected ${expectedDedupSource}, got ${loaded.behaviorSources.dedupMode}`,
              );
            }
            if (
              loaded.behaviorSources.repomixMissingExtension !==
              expectedRepomixSource
            ) {
              throw new Error(
                `repomix source mismatch: expected ${expectedRepomixSource}, got ${loaded.behaviorSources.repomixMissingExtension}`,
              );
            }
            if (
              loaded.behaviorSources.configDuplicateEntry !==
              expectedDuplicateSource
            ) {
              throw new Error(
                `duplicate source mismatch: expected ${expectedDuplicateSource}, got ${loaded.behaviorSources.configDuplicateEntry}`,
              );
            }
            if (loaded.behaviorSources.assetsLayout !== expectedAssetsSource) {
              throw new Error(
                `assets source mismatch: expected ${expectedAssetsSource}, got ${loaded.behaviorSources.assetsLayout}`,
              );
            }
          },
        ),
        { numRuns: 60 },
      );
    } finally {
      await fs.rm(root, { recursive: true, force: true });
      if (originalStrict === undefined) {
        delete process.env.CX_STRICT;
      } else {
        process.env.CX_STRICT = originalStrict;
      }
    }
  });
});
