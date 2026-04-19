import fs from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Repomix adapter capability detection
 * Runtime feature detection instead of semver-based gating
 */

export interface AdapterRuntimeInfo {
  packageName: string;
  packageVersion: string;
}

export interface RepomixCapabilities {
  hasMergeConfigs: boolean;
  hasPack: boolean;
  supportsPackStructured: boolean;
  supportsRenderWithMap: boolean;
}

const DEFAULT_ADAPTER = "@wsmy/repomix-cx-fork";
let _adapterPath: string | undefined;
const require = createRequire(import.meta.url);

/**
 * Override the Repomix adapter module path.
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

/**
 * Get runtime info about the installed Repomix adapter package.
 * Tries the configured adapter path first, then falls back to the default.
 */
export async function getAdapterRuntimeInfo(): Promise<AdapterRuntimeInfo> {
  const adapterPath = getAdapterModulePath();
  const pathsToTry =
    adapterPath !== DEFAULT_ADAPTER
      ? [adapterPath, DEFAULT_ADAPTER]
      : [DEFAULT_ADAPTER];

  for (const p of pathsToTry) {
    try {
      const pkg = (await import(`${p}/package.json`, {
        with: { type: "json" },
      })) as {
        default: { name?: string; version?: string };
      };
      return {
        packageName: pkg.default.name ?? p,
        packageVersion: pkg.default.version ?? "unknown",
      };
    } catch {
      const nearbyPackage = await findPackageJsonNearAdapter(p);
      if (nearbyPackage) {
        return nearbyPackage;
      }
    }
  }

  return {
    packageName: adapterPath,
    packageVersion: "unknown",
  };
}

/**
 * Detect which Repomix capabilities are available in the configured adapter module.
 */
export async function detectRepomixCapabilities(): Promise<RepomixCapabilities> {
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
 * Validate that the installed adapter meets the minimum contract:
 * mergeConfigs.
 */
export async function validateRepomixContract(): Promise<
  { valid: true } | { valid: false; errors: string[] }
> {
  const capabilities = await detectRepomixCapabilities();
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
export async function getRepomixCapabilities() {
  const runtimeInfo = await getAdapterRuntimeInfo();
  const capabilities = await detectRepomixCapabilities();
  const contractValidation = await validateRepomixContract();

  return {
    ...runtimeInfo,
    capabilities,
    contractValid: contractValidation.valid,
    contractErrors:
      contractValidation.valid === false ? contractValidation.errors : [],
  };
}

/**
 * Throw CxError if contract validation fails.
 */
export async function requireRepomixContract(): Promise<void> {
  const validation = await validateRepomixContract();
  if (!validation.valid) {
    const { CxError } = await import("../shared/errors.js");
    throw new CxError(validation.errors.join("\n"), 2);
  }
}
