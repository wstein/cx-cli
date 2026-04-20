import fs from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Adapter capability detection via runtime feature checks instead of semver gating.
 */

export interface AdapterRuntimeInfo {
  packageName: string;
  packageVersion: string;
}

export interface ReferenceAdapterRuntimeInfo extends AdapterRuntimeInfo {
  installed: boolean;
}

export interface AdapterCapabilities {
  hasMergeConfigs: boolean;
  hasPack: boolean;
  supportsPackStructured: boolean;
  supportsRenderWithMap: boolean;
}

export const ADAPTER_CONTRACT = "repomix-pack-v1";

const DEFAULT_ADAPTER = "@wsmy/repomix-cx-fork";
const DEFAULT_REFERENCE_ADAPTER = "repomix";
let _adapterPath: string | undefined;
const require = createRequire(import.meta.url);

/**
 * Override the adapter module path.
 * Must be called before any adapter operation (e.g. from CLI middleware).
 */
export function setAdapterPath(p: string): void {
  _adapterPath = p;
}

/** The effective adapter module path: the override if set, or the default scoped fork. */
export function getAdapterModulePath(): string {
  return _adapterPath ?? DEFAULT_ADAPTER;
}

async function findPackageJsonNearAdapter(
  adapterPath: string,
): Promise<AdapterRuntimeInfo | undefined> {
  try {
    let entryPath: string;
    if (adapterPath.startsWith("file:")) {
      entryPath = fileURLToPath(adapterPath);
    } else if (path.isAbsolute(adapterPath) || adapterPath.startsWith(".")) {
      entryPath = adapterPath;
    } else {
      entryPath = require.resolve(adapterPath);
    }

    let currentDir = path.dirname(entryPath);
    while (currentDir !== path.dirname(currentDir)) {
      const packageJsonPath = path.join(currentDir, "package.json");
      try {
        const raw = await fs.readFile(packageJsonPath, "utf8");
        const parsed = JSON.parse(raw) as { name?: string; version?: string };
        return {
          packageName: parsed.name ?? adapterPath,
          packageVersion: parsed.version ?? "unknown",
        };
      } catch {
        currentDir = path.dirname(currentDir);
      }
    }
  } catch {
    // Fall through to the caller's fallback.
  }

  return undefined;
}

async function getAdapterRuntimeInfoForPath(
  adapterPath: string,
): Promise<AdapterRuntimeInfo | undefined> {
  try {
    const pkg = (await import(`${adapterPath}/package.json`, {
      with: { type: "json" },
    })) as {
      default: { name?: string; version?: string };
    };
    return {
      packageName: pkg.default.name ?? adapterPath,
      packageVersion: pkg.default.version ?? "unknown",
    };
  } catch {
    return findPackageJsonNearAdapter(adapterPath);
  }
}

/**
 * Get runtime info about the installed adapter package.
 * Tries the configured adapter path first, then falls back to the default.
 */
export async function getAdapterRuntimeInfo(): Promise<AdapterRuntimeInfo> {
  const adapterPath = getAdapterModulePath();
  const pathsToTry =
    adapterPath !== DEFAULT_ADAPTER
      ? [adapterPath, DEFAULT_ADAPTER]
      : [DEFAULT_ADAPTER];

  for (const p of pathsToTry) {
    const runtimeInfo = await getAdapterRuntimeInfoForPath(p);
    if (runtimeInfo) {
      return runtimeInfo;
    }
  }

  return {
    packageName: adapterPath,
    packageVersion: "unknown",
  };
}

export function getReferenceAdapterModulePath(): string {
  return DEFAULT_REFERENCE_ADAPTER;
}

export async function getReferenceAdapterRuntimeInfo(): Promise<ReferenceAdapterRuntimeInfo> {
  const runtimeInfo = await getAdapterRuntimeInfoForPath(
    getReferenceAdapterModulePath(),
  );
  if (runtimeInfo) {
    return {
      ...runtimeInfo,
      installed: true,
    };
  }

  return {
    packageName: getReferenceAdapterModulePath(),
    packageVersion: "unavailable",
    installed: false,
  };
}

/**
 * Detect which capabilities are available in the configured adapter module.
 */
export async function detectAdapterCapabilities(): Promise<AdapterCapabilities> {
  try {
    const mod = (await import(getAdapterModulePath())) as Record<
      string,
      unknown
    >;
    return {
      hasMergeConfigs: typeof mod.mergeConfigs === "function",
      hasPack: typeof mod.pack === "function",
      supportsPackStructured: typeof mod.packStructured === "function",
      supportsRenderWithMap: typeof mod.packStructured === "function",
    };
  } catch {
    return {
      hasMergeConfigs: false,
      hasPack: false,
      supportsPackStructured: false,
      supportsRenderWithMap: false,
    };
  }
}

/**
 * Validate that the installed adapter meets the minimum contract: `mergeConfigs`.
 */
export async function validateAdapterContract(): Promise<
  { valid: true } | { valid: false; errors: string[] }
> {
  const capabilities = await detectAdapterCapabilities();
  const adapterPath = getAdapterModulePath();
  const errors: string[] = [];

  if (!capabilities.hasMergeConfigs) {
    errors.push(
      `${adapterPath} does not export mergeConfigs(); this is required by cx-cli.`,
    );
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return { valid: true };
}

/**
 * Get runtime version info including capabilities.
 * Used by adapter commands to display environment details.
 */
export async function getAdapterCapabilities() {
  const runtimeInfo = await getAdapterRuntimeInfo();
  const referenceRuntimeInfo = await getReferenceAdapterRuntimeInfo();
  const capabilities = await detectAdapterCapabilities();
  const contractValidation = await validateAdapterContract();
  let spanCapability: "supported" | "unsupported" | "partial" = "unsupported";
  let spanCapabilityReason =
    "Structured span capture is unavailable in the installed adapter.";

  if (capabilities.supportsRenderWithMap) {
    spanCapability = "supported";
    spanCapabilityReason = "renderWithMap available and used";
  } else if (capabilities.supportsPackStructured) {
    spanCapability = "partial";
    spanCapabilityReason =
      "packStructured is available, but renderWithMap is unavailable.";
  }

  return {
    oracleAdapter: {
      modulePath: getAdapterModulePath(),
      packageName: runtimeInfo.packageName,
      packageVersion: runtimeInfo.packageVersion,
      adapterContract: ADAPTER_CONTRACT,
      compatibilityStrategy:
        "core contract with optional structured rendering and span capture",
      contractValid: contractValidation.valid,
      contractErrors:
        contractValidation.valid === false ? contractValidation.errors : [],
    },
    referenceAdapter: {
      modulePath: getReferenceAdapterModulePath(),
      packageName: referenceRuntimeInfo.packageName,
      packageVersion: referenceRuntimeInfo.packageVersion,
      installed: referenceRuntimeInfo.installed,
      usage: "reference-only parity target",
    },
    capabilities,
    spanCapability,
    spanCapabilityReason,
  };
}

/**
 * Throw CxError if contract validation fails.
 */
export async function requireAdapterContract(): Promise<void> {
  const validation = await validateAdapterContract();
  if (!validation.valid) {
    const { CxError } = await import("../shared/errors.js");
    throw new CxError(validation.errors.join("\n"), 2);
  }
}
