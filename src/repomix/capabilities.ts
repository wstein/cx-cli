/**
 * Repomix adapter capability detection
 * Runtime feature detection instead of semver-based gating
 */

import * as repomixModule from "@wstein/repomix";

export interface AdapterRuntimeInfo {
  packageName: string;
  packageVersion: string;
}

export interface RepomixCapabilities {
  hasMergeConfigs: boolean;
  hasPack: boolean;
  hasPackStructured: boolean;
  supportsStructuredRenderPlan: boolean;
}

/**
 * Get runtime info about the installed @wstein/repomix package
 */
export async function getAdapterRuntimeInfo(): Promise<AdapterRuntimeInfo> {
  try {
    // Dynamic import to read package.json metadata
    // @ts-expect-error - JSON subpath imports require module aliasing in TypeScript
    const pkg = (await import("@wstein/repomix/package.json", {
      with: { type: "json" },
    })) as {
      default: { name?: string; version?: string };
    };

    return {
      packageName: pkg.default.name ?? "@wstein/repomix",
      packageVersion: pkg.default.version ?? "unknown",
    };
  } catch {
    return {
      packageName: "@wstein/repomix",
      packageVersion: "unknown",
    };
  }
}

/**
 * Detect which Repomix capabilities are available in the installed module
 */
export function detectRepomixCapabilities(): RepomixCapabilities {
  return {
    hasMergeConfigs: typeof repomixModule.mergeConfigs === "function",
    hasPack: typeof repomixModule.pack === "function",
    hasPackStructured: typeof repomixModule.packStructured === "function",
    supportsStructuredRenderPlan:
      typeof repomixModule.packStructured === "function",
  };
}

/**
 * Validate that installed @wstein/repomix meets minimum contract
 * Minimum: mergeConfigs + pack + packStructured (for cx-cli)
 */
export function validateRepomixContract():
  | { valid: true }
  | { valid: false; errors: string[] } {
  const capabilities = detectRepomixCapabilities();
  const errors: string[] = [];

  if (!capabilities.hasMergeConfigs) {
    errors.push(
      "Installed @wstein/repomix does not export mergeConfigs(); this is required by cx-cli.",
    );
  }

  if (!capabilities.hasPack) {
    errors.push(
      "Installed @wstein/repomix does not export pack(); this is required by cx-cli.",
    );
  }

  if (!capabilities.hasPackStructured) {
    errors.push(
      "Installed @wstein/repomix does not export packStructured(); structured render plan support is required by this cx-cli version.",
    );
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return { valid: true };
}

/**
 * Get runtime version info including capabilities
 * Used by adapter commands to display environment details
 */
export async function getRepomixCapabilities() {
  const runtimeInfo = await getAdapterRuntimeInfo();
  const capabilities = detectRepomixCapabilities();
  const contractValidation = validateRepomixContract();

  return {
    ...runtimeInfo,
    capabilities,
    contractValid: contractValidation.valid,
    contractErrors:
      contractValidation.valid === false ? contractValidation.errors : [],
  };
}

/**
 * Throw CxError if contract validation fails
 */
export async function requireRepomixContract(): Promise<void> {
  const validation = validateRepomixContract();
  if (!validation.valid) {
    const { CxError } = await import("../shared/errors.js");
    throw new CxError(validation.errors.join("\n"), 2);
  }
}
