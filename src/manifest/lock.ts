/**
 * cx.lock — effective behavioral-settings capture written alongside each bundle.
 *
 * The lock file records the resolved Category B settings at bundle time,
 * together with their sources and the cx version. cx verify reads it and warns
 * when the current effective settings differ from what was used to produce the
 * bundle.
 *
 * The lock is advisory by default: a mismatch emits a warning. With --strict
 * a mismatch becomes a hard error, because dedup.mode=warn vs fail can produce
 * different file assignments in sections with overlapping patterns.
 *
 * File name: {project}-lock.json — stored in the bundle directory and included
 * in the checksum sidecar so tampering is detected by cx verify.
 */

import fs from "node:fs/promises";
import path from "node:path";

import type {
  CxAssetsLayout,
  CxConfigDuplicateEntryMode,
  CxDedupMode,
  CxRepomixMissingExtensionMode,
} from "../config/types.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type LockSettingSource =
  | "compiled default"
  | "cx.toml"
  | "env var"
  | "CX_STRICT"
  | "cli flag";

export interface LockSetting<T extends string> {
  value: T;
  source: LockSettingSource;
}

export interface CxLockFile {
  schemaVersion: 1;
  cxVersion: string;
  bundledAt: string;
  behavioralSettings: {
    "dedup.mode": LockSetting<CxDedupMode>;
    "repomix.missing_extension": LockSetting<CxRepomixMissingExtensionMode>;
    "config.duplicate_entry": LockSetting<CxConfigDuplicateEntryMode>;
    "assets.layout": LockSetting<CxAssetsLayout>;
  };
}

export interface LockSettingMismatch {
  setting: string;
  locked: string;
  lockedSource: LockSettingSource;
  current: string;
  currentSource: string;
}

// ---------------------------------------------------------------------------
// File name convention
// ---------------------------------------------------------------------------

/** Derive the standard lock file name from a project name. */
export function lockFileName(projectName: string): string {
  return `${projectName}-lock.json`;
}

// ---------------------------------------------------------------------------
// Read / write
// ---------------------------------------------------------------------------

/** Serialize and write the lock file to the bundle directory. */
export async function writeLock(
  bundleDir: string,
  projectName: string,
  lockFile: CxLockFile,
): Promise<void> {
  await fs.writeFile(
    path.join(bundleDir, lockFileName(projectName)),
    `${JSON.stringify(lockFile, null, 2)}\n`,
    "utf8",
  );
}

/**
 * Read and parse the lock file from a bundle directory.
 * Returns null when the file is absent or its schema is unrecognised.
 */
export async function readLock(
  bundleDir: string,
  projectName: string,
): Promise<CxLockFile | null> {
  const filePath = path.join(bundleDir, lockFileName(projectName));
  try {
    const raw = await fs.readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    return isValidLockFile(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function isValidLockFile(value: unknown): value is CxLockFile {
  if (typeof value !== "object" || value === null) return false;
  const obj = value as Record<string, unknown>;
  return (
    obj.schemaVersion === 1 &&
    typeof obj.cxVersion === "string" &&
    typeof obj.bundledAt === "string" &&
    typeof obj.behavioralSettings === "object" &&
    obj.behavioralSettings !== null
  );
}

// ---------------------------------------------------------------------------
// Comparison
// ---------------------------------------------------------------------------

export interface CurrentBehaviorSnapshot {
  dedupMode: { value: string; source: string };
  repomixMissingExtension: { value: string; source: string };
  configDuplicateEntry: { value: string; source: string };
  assetsLayout: { value: string; source: string };
}

/**
 * Compare the locked behavioral settings against the current effective settings.
 * Returns the list of settings that differ. An empty array means no drift.
 */
export function diffLockSettings(
  locked: CxLockFile,
  current: CurrentBehaviorSnapshot,
): LockSettingMismatch[] {
  const mismatches: LockSettingMismatch[] = [];
  const settings = locked.behavioralSettings;

  const pairs: Array<
    [keyof typeof settings, { value: string; source: string }]
  > = [
    ["dedup.mode", current.dedupMode],
    ["repomix.missing_extension", current.repomixMissingExtension],
    ["config.duplicate_entry", current.configDuplicateEntry],
    ["assets.layout", current.assetsLayout],
  ];

  for (const [key, cur] of pairs) {
    const lockedEntry = settings[key];
    if (lockedEntry.value !== cur.value) {
      mismatches.push({
        setting: key,
        locked: lockedEntry.value,
        lockedSource: lockedEntry.source,
        current: cur.value,
        currentSource: cur.source,
      });
    }
  }

  return mismatches;
}
