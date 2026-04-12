/**
 * Environment variable override layer for Category B behavioral settings.
 *
 * Precedence chain (highest to lowest):
 *   CLI flag > CX_* env var > project cx.toml > user cx.toml > compiled default
 *
 * CX_STRICT=true is a convenience shorthand that sets every Category B setting to
 * its strictest value ("fail"), overriding any cx.toml values. It does not affect
 * Category A invariants — those are always hard failures regardless of mode.
 * CX_STRICT does not affect CX_ASSETS_LAYOUT.
 *
 * Category B env vars:
 *   CX_DEDUP_MODE                  — "fail" | "warn" | "first-wins"
 *   CX_REPOMIX_MISSING_EXTENSION   — "fail" | "warn"
 *   CX_CONFIG_DUPLICATE_ENTRY      — "fail" | "warn" | "first-wins"
 *   CX_ASSETS_LAYOUT               — "flat" | "deep"
 */

import { CxError } from "../shared/errors.js";
import type {
  CxAssetsLayout,
  CxConfigDuplicateEntryMode,
  CxDedupMode,
  CxRepomixMissingExtensionMode,
} from "./types.js";

export interface CxEnvOverrides {
  dedupMode?: CxDedupMode;
  repomixMissingExtension?: CxRepomixMissingExtensionMode;
  configDuplicateEntry?: CxConfigDuplicateEntryMode;
  assetsLayout?: CxAssetsLayout;
}

/** The source from which a Category B setting was resolved. */
export type SettingSource =
  | "compiled default"
  | "cx.toml"
  | "env var"
  | "cli flag";

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
const VALID_ASSETS_LAYOUT = new Set<CxAssetsLayout>(["flat", "deep"]);

function readEnumVar<T extends string>(
  name: string,
  valid: Set<T>,
): T | undefined {
  const raw = process.env[name];
  if (raw === undefined) return undefined;

  if (!valid.has(raw as T)) {
    throw new CxError(
      `${name} must be one of: ${[...valid].join(", ")}. Got: "${raw}".`,
    );
  }

  return raw as T;
}

// ---------------------------------------------------------------------------
// CLI-level override state (sits above env vars in the precedence chain)
// ---------------------------------------------------------------------------

let _cliOverrides: CxEnvOverrides = {};

/**
 * Set overrides that originate from CLI flags (--strict / --lenient).
 * Call this in yargs middleware before any command handler runs.
 * These take precedence over CX_* env vars.
 */
export function setCLIOverrides(overrides: CxEnvOverrides): void {
  _cliOverrides = overrides;
}

/** Return the current CLI-level overrides (empty object if none are set). */
export function getCLIOverrides(): Readonly<CxEnvOverrides> {
  return _cliOverrides;
}

// ---------------------------------------------------------------------------
// Env var reading
// ---------------------------------------------------------------------------

/**
 * Read Category B behavioral overrides from the environment.
 *
 * When CX_STRICT=true (or CX_STRICT=1), all Category B settings are forced to
 * "fail". Per-area env vars are ignored when CX_STRICT is active.
 */
export function readEnvOverrides(): CxEnvOverrides {
  const strict = process.env.CX_STRICT;

  if (strict === "true" || strict === "1") {
    return {
      dedupMode: "fail",
      repomixMissingExtension: "fail",
      configDuplicateEntry: "fail",
    };
  }

  const overrides: CxEnvOverrides = {};

  const dedupMode = readEnumVar("CX_DEDUP_MODE", VALID_DEDUP_MODES);
  if (dedupMode !== undefined) overrides.dedupMode = dedupMode;

  const repomixMissingExtension = readEnumVar(
    "CX_REPOMIX_MISSING_EXTENSION",
    VALID_REPOMIX_MISSING,
  );
  if (repomixMissingExtension !== undefined) {
    overrides.repomixMissingExtension = repomixMissingExtension;
  }

  const configDuplicateEntry = readEnumVar(
    "CX_CONFIG_DUPLICATE_ENTRY",
    VALID_CONFIG_DUPLICATE,
  );
  if (configDuplicateEntry !== undefined) {
    overrides.configDuplicateEntry = configDuplicateEntry;
  }

  // CX_ASSETS_LAYOUT is independent of CX_STRICT — it is always read from the
  // environment regardless of whether strict mode is active.
  const assetsLayout = readEnumVar("CX_ASSETS_LAYOUT", VALID_ASSETS_LAYOUT);
  if (assetsLayout !== undefined) overrides.assetsLayout = assetsLayout;

  return overrides;
}
