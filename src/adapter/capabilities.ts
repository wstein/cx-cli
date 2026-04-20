import fs from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Oracle-adapter capability detection via runtime feature checks instead of
 * semver gating.
 *
 * The native proof path does not pass through this seam during ordinary bundle,
 * verify, validate, or extract operations.
 */

export interface OracleAdapterRuntimeInfo {
  packageName: string;
  packageVersion: string;
}

export interface ReferenceOracleRuntimeInfo extends OracleAdapterRuntimeInfo {
  installed: boolean;
}

export interface OracleAdapterCapabilities {
  hasMergeConfigs: boolean;
  hasPack: boolean;
  supportsPackStructured: boolean;
  supportsRenderWithMap: boolean;
}

export const ADAPTER_CONTRACT = "repomix-pack-v1";

const DEFAULT_ORACLE_ADAPTER = "repomix";
const DEFAULT_REFERENCE_ADAPTER = "repomix";
let _adapterPath: string | undefined;
const require = createRequire(import.meta.url);

/**
 * Override the adapter module path.
 * Must be called before any adapter operation (e.g. from CLI middleware).
 */
export function setOracleAdapterPath(p: string): void {
  _adapterPath = p;
}

/**
 * The effective oracle module path for expert adapter diagnostics and parity
 * rendering. Ordinary kernel-owned proof-path execution does not consult it.
 */
export function getOracleAdapterModulePath(): string {
  return _adapterPath ?? DEFAULT_ORACLE_ADAPTER;
}

async function findPackageJsonNearAdapter(
  adapterPath: string,
): Promise<OracleAdapterRuntimeInfo | undefined> {
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

async function getOracleRuntimeInfoForPath(
  adapterPath: string,
): Promise<OracleAdapterRuntimeInfo | undefined> {
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

export async function getOracleAdapterRuntimeInfo(): Promise<OracleAdapterRuntimeInfo> {
  const adapterPath = getOracleAdapterModulePath();
  const pathsToTry =
    adapterPath !== DEFAULT_ORACLE_ADAPTER
      ? [adapterPath, DEFAULT_ORACLE_ADAPTER]
      : [DEFAULT_ORACLE_ADAPTER];

  for (const p of pathsToTry) {
    const runtimeInfo = await getOracleRuntimeInfoForPath(p);
    if (runtimeInfo) {
      return runtimeInfo;
    }
  }

  return {
    packageName: adapterPath,
    packageVersion: "unknown",
  };
}

export function getReferenceOracleAdapterModulePath(): string {
  return DEFAULT_REFERENCE_ADAPTER;
}

export async function getReferenceOracleRuntimeInfo(): Promise<ReferenceOracleRuntimeInfo> {
  const runtimeInfo = await getOracleRuntimeInfoForPath(
    getReferenceOracleAdapterModulePath(),
  );
  if (runtimeInfo) {
    return {
      ...runtimeInfo,
      installed: true,
    };
  }

  return {
    packageName: getReferenceOracleAdapterModulePath(),
    packageVersion: "unavailable",
    installed: false,
  };
}

/**
 * Detect which capabilities are available in the configured oracle adapter
 * module. The native proof path does not consult this during ordinary bundle
 * or verify flows.
 */
export async function detectOracleAdapterCapabilities(): Promise<OracleAdapterCapabilities> {
  try {
    const mod = (await import(getOracleAdapterModulePath())) as Record<
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
 * Validate that the configured oracle adapter meets the minimum comparison
 * contract needed by adapter diagnostics and oracle rendering.
 */
export async function validateOracleAdapterContract(): Promise<
  { valid: true } | { valid: false; errors: string[] }
> {
  const capabilities = await detectOracleAdapterCapabilities();
  const adapterPath = getOracleAdapterModulePath();
  const errors: string[] = [];

  const runtimeInfo = await getOracleRuntimeInfoForPath(adapterPath);
  if (!runtimeInfo) {
    errors.push(
      `${adapterPath} could not be loaded; install the reference oracle or pass --adapter-path to a compatible module.`,
    );
  }

  if (!capabilities.hasMergeConfigs) {
    errors.push(
      `${adapterPath} does not export mergeConfigs(); this is required for cx adapter diagnostics and oracle operations.`,
    );
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return { valid: true };
}

/**
 * Get runtime version info including capabilities.
 * Used by expert adapter/oracle commands to display environment details.
 */
export async function getOracleAdapterCapabilities() {
  const runtimeInfo = await getOracleAdapterRuntimeInfo();
  const referenceRuntimeInfo = await getReferenceOracleRuntimeInfo();
  const capabilities = await detectOracleAdapterCapabilities();
  const contractValidation = await validateOracleAdapterContract();
  let spanCapability: "supported" | "unsupported" | "partial" = "unsupported";
  let spanCapabilityReason =
    "Structured span capture is unavailable in the selected oracle adapter.";

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
      modulePath: getOracleAdapterModulePath(),
      packageName: runtimeInfo.packageName,
      packageVersion: runtimeInfo.packageVersion,
      adapterContract: ADAPTER_CONTRACT,
      compatibilityStrategy:
        "optional parity oracle; native kernel owns the production proof path",
      contractValid: contractValidation.valid,
      contractErrors:
        contractValidation.valid === false ? contractValidation.errors : [],
    },
    referenceAdapter: {
      modulePath: getReferenceOracleAdapterModulePath(),
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
 * Throw CxError if the oracle diagnostics contract validation fails.
 */
export async function requireOracleAdapterContract(): Promise<void> {
  const validation = await validateOracleAdapterContract();
  if (!validation.valid) {
    const { CxError } = await import("../shared/errors.js");
    throw new CxError(validation.errors.join("\n"), 2);
  }
}
