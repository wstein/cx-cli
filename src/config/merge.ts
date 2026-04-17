/**
 * Explicit config merge semantics for safety and auditability.
 *
 * Merge rules (enforced):
 * - Scalars: overwrite (right wins)
 * - Arrays: append only (never silent replace)
 * - Objects: deep merge (recursive application of rules)
 * - undefined: treated as "not set"
 * - null: valid value that can overwrite
 */

import { CxError } from "../shared/errors.js";

export interface MergeResult<T> {
  value: T;
  conflicts: MergeConflict[];
}

export interface MergeConflict {
  path: string;
  reason: string;
  baseValue: unknown;
  overrideValue: unknown;
}

/**
 * Merge two config objects with explicit semantics.
 * Returns merged result and list of any conflicts detected.
 */
export function mergeConfigs<T extends Record<string, unknown>>(
  base: T,
  override: T,
  options: {
    allowArrayOverwrite?: boolean;
  } = {},
): MergeResult<T> {
  const conflicts: MergeConflict[] = [];
  const merged = mergeValues(base, override, "", conflicts, options);

  return {
    value: merged as T,
    conflicts,
  };
}

function mergeValues(
  base: unknown,
  override: unknown,
  path: string,
  conflicts: MergeConflict[],
  options: { allowArrayOverwrite?: boolean },
): unknown {
  // Treat undefined as "not set", but null is a valid value
  if (base === undefined) {
    return override;
  }
  if (override === undefined) {
    return base;
  }

  // Scalar types: override wins
  if (typeof base !== "object" || typeof override !== "object") {
    if (base !== override) {
      conflicts.push({
        path: path || "root",
        reason: "scalar value replaced",
        baseValue: base,
        overrideValue: override,
      });
    }
    return override;
  }

  // Array handling: append only (not replace)
  if (Array.isArray(base) && Array.isArray(override)) {
    if (base.length > 0 && override.length > 0) {
      conflicts.push({
        path: path || "root",
        reason: "array append behavior: both base and override are non-empty",
        baseValue: base,
        overrideValue: override,
      });
    }

    if (options.allowArrayOverwrite) {
      return override;
    }

    // Append strategy: override extends base
    return [...base, ...override];
  }

  // One is array, other is not: error
  if (Array.isArray(base) !== Array.isArray(override)) {
    throw new CxError(
      `Type mismatch at ${path}: cannot merge array with non-array`,
      2,
    );
  }

  // Object handling: deep merge
  const merged: Record<string, unknown> = {};
  const baseObj = base as Record<string, unknown>;
  const overrideObj = override as Record<string, unknown>;

  // Merge base keys
  for (const key of Object.keys(baseObj)) {
    merged[key] = baseObj[key];
  }

  // Merge override keys
  for (const key of Object.keys(overrideObj)) {
    const newPath = path ? `${path}.${key}` : key;

    if (key in merged) {
      // Key exists in both: recurse
      merged[key] = mergeValues(
        merged[key],
        overrideObj[key],
        newPath,
        conflicts,
        options,
      );
    } else {
      // Key only in override: add it
      merged[key] = overrideObj[key];
    }
  }

  return merged;
}

/**
 * Validate that a config does not have problematic merge patterns.
 */
export function validateMergeConfig(config: unknown): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (typeof config !== "object" || config === null) {
    return { valid: true, errors };
  }

  const obj = config as Record<string, unknown>;

  // Check for "extends" chains (should be caught during load, but verify here)
  if (obj.extends && typeof obj.extends === "object") {
    const extended = obj.extends as Record<string, unknown>;
    if (extended.extends) {
      errors.push("Deep extends chains are forbidden");
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
