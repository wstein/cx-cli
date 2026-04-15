import path from "node:path";
import { loadManifestFromBundle } from "../../bundle/validate.js";
import { VerifyError, verifyBundle } from "../../bundle/verify.js";
import { loadCxConfig } from "../../config/load.js";
import {
  type CurrentBehaviorSnapshot,
  diffLockSettings,
  type LockSettingMismatch,
  readLock,
} from "../../manifest/lock.js";
import { getRepomixCapabilities } from "../../repomix/render.js";
import { CxError } from "../../shared/errors.js";
import {
  printDivider,
  printHeader,
  printSuccess,
  printTable,
} from "../../shared/format.js";
import { pathExists } from "../../shared/fs.js";
import { writeJson } from "../../shared/output.js";
import type { DirtyState } from "../../vcs/provider.js";

export interface VerifyArgs {
  bundleDir: string;
  files?: string[] | undefined;
  json?: boolean | undefined;
  sections?: string[] | undefined;
  againstDir?: string | undefined;
  /** Path to cx.toml for lock drift comparison. Defaults to "cx.toml" in cwd. */
  config?: string | undefined;
}

/**
 * Build the current behavioral settings snapshot from the loaded config.
 * Falls back to env/CLI-only when no config file is available.
 */
async function buildCurrentSnapshot(
  configPath: string,
): Promise<CurrentBehaviorSnapshot | null> {
  if (!(await pathExists(configPath))) return null;

  try {
    const config = await loadCxConfig(configPath);
    return {
      dedupMode: {
        value: config.dedup.mode,
        source: config.behaviorSources.dedupMode,
      },
      repomixMissingExtension: {
        value: config.behavior.repomixMissingExtension,
        source: config.behaviorSources.repomixMissingExtension,
      },
      configDuplicateEntry: {
        value: config.behavior.configDuplicateEntry,
        source: config.behaviorSources.configDuplicateEntry,
      },
      assetsLayout: {
        value: config.assets.layout,
        source: config.behaviorSources.assetsLayout,
      },
      includeLinkedNotes: {
        value: config.manifest.includeLinkedNotes ? "true" : "false",
        source: "cx.toml",
      },
    };
  } catch {
    return null;
  }
}

export async function runVerifyCommand(args: VerifyArgs): Promise<number> {
  const bundleDir = path.resolve(args.bundleDir);
  const againstDir = args.againstDir
    ? path.resolve(args.againstDir)
    : undefined;
  const selection = {
    sections: args.sections,
    files: args.files,
  };
  const configPath = args.config ?? "cx.toml";
  const againstConfig = againstDir ? await loadCxConfig(configPath) : undefined;

  // Initialize these outside the try block so they're accessible in error handler
  let projectName: string | null = null;
  let manifestDirtyState: DirtyState | null = null;
  let bundleMode: string | null = null;

  try {
    await verifyBundle(bundleDir, againstDir, selection, againstConfig);

    // Load manifest for projectName and dirtyState visibility
    try {
      const { manifest } = await loadManifestFromBundle(bundleDir);
      projectName = manifest.projectName;
      manifestDirtyState = manifest.dirtyState as DirtyState | null;
    } catch {
      // If manifest load fails, we still proceed with lock drift check
    }

    // Emit warnings for dirty state so operators see at a glance whether the
    // bundle was built from uncommitted changes, and via what mechanism.
    const lockWarnings: string[] = [];
    if (manifestDirtyState === "ci_dirty") {
      const msg =
        "Bundle was created in a CI pipeline with uncommitted changes (ci_dirty). " +
        "Artifact content may not reflect the committed source tree.";
      lockWarnings.push(msg);
      process.stderr.write(`Warning: ${msg}\n`);
    } else if (manifestDirtyState === "forced_dirty") {
      const msg =
        "Bundle was created with --force while tracked files had uncommitted changes (forced_dirty).";
      lockWarnings.push(msg);
      process.stderr.write(`Warning: ${msg}\n`);
    }

    // Lock drift check: compare behavioral settings used at bundle time with
    // the current effective settings. Warn on mismatch; --strict makes it a
    // hard error (enforced by the caller via --strict CLI flag).
    const lockMismatches: LockSettingMismatch[] = [];

    if (projectName !== null) {
      const lock = await readLock(bundleDir, projectName);
      if (lock !== null) {
        bundleMode = lock.bundleMode ?? null;

        const current = await buildCurrentSnapshot(configPath);
        if (current !== null) {
          const mismatches = diffLockSettings(lock, current);
          for (const m of mismatches) {
            const msg =
              `Behavioral setting drift: ${m.setting} was "${m.locked}" ` +
              `(${m.lockedSource}) at bundle time, now "${m.current}" (${m.currentSource}).`;
            lockWarnings.push(msg);
            process.stderr.write(`Warning: ${msg}\n`);
          }
          lockMismatches.push(...mismatches);
        }
      }
    }

    // Emit bundleMode as info for audit visibility
    if (bundleMode !== null) {
      process.stderr.write(`Info: bundleMode=${bundleMode}\n`);
    }

    if (!(args.json ?? false)) {
      printHeader("Verification Complete");
      printTable([["Bundle", bundleDir]]);
      if (againstDir) {
        printTable([["Against", againstDir]]);
      }
      printDivider();
      printSuccess("Bundle is valid");
    }

    if (args.json ?? false) {
      writeJson({
        bundleDir,
        againstDir: againstDir ?? null,
        sections: args.sections ?? [],
        files: args.files ?? [],
        repomix: await getRepomixCapabilities(),
        valid: true,
        dirtyState: manifestDirtyState,
        bundleMode: bundleMode,
        warnings: lockWarnings,
        lockDrift: lockMismatches.length > 0 ? lockMismatches : null,
      });
    }
    return 0;
  } catch (error) {
    if (args.json ?? false) {
      const resolvedError =
        error instanceof Error ? error : new Error(String(error));
      const payload: {
        bundleDir: string;
        againstDir: string | null;
        sections: string[];
        files: string[];
        repomix: Awaited<ReturnType<typeof getRepomixCapabilities>>;
        valid: false;
        dirtyState: DirtyState | null;
        bundleMode: string | null;
        error: {
          type?: string;
          message: string;
          path?: string;
        };
      } = {
        bundleDir,
        againstDir: againstDir ?? null,
        sections: args.sections ?? [],
        files: args.files ?? [],
        repomix: await getRepomixCapabilities(),
        valid: false,
        dirtyState: manifestDirtyState,
        bundleMode: bundleMode,
        error: {
          message: resolvedError.message,
        },
      };

      if (error instanceof VerifyError) {
        payload.error.type = error.type;
        if (error.relativePath) {
          payload.error.path = error.relativePath;
        }
      }

      writeJson(payload);
      return error instanceof CxError ? error.exitCode : 1;
    }

    throw error;
  }
}
