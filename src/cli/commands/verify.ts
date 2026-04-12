import path from "node:path";

import { VerifyError, verifyBundle } from "../../bundle/verify.js";
import { loadCxConfig } from "../../config/load.js";
import {
  diffLockSettings,
  readLock,
  type LockSettingMismatch,
} from "../../manifest/lock.js";
import { loadManifestFromBundle } from "../../bundle/validate.js";
import { getRepomixCapabilities } from "../../repomix/render.js";
import { CxError } from "../../shared/errors.js";
import { pathExists } from "../../shared/fs.js";
import {
  printDivider,
  printHeader,
  printSuccess,
  printTable,
} from "../../shared/format.js";
import { writeJson } from "../../shared/output.js";

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
 * Read the project name from the bundle directory so we can load the lock file
 * without requiring a full config load.
 */
async function readProjectNameFromBundle(bundleDir: string): Promise<string | null> {
  try {
    const { manifest } = await loadManifestFromBundle(bundleDir);
    return manifest.projectName;
  } catch {
    return null;
  }
}

/**
 * Build the current behavioral settings snapshot from the loaded config.
 * Falls back to env/CLI-only when no config file is available.
 */
async function buildCurrentSnapshot(
  configPath: string,
): Promise<{
  dedupMode: { value: string; source: string };
  repomixMissingExtension: { value: string; source: string };
  configDuplicateEntry: { value: string; source: string };
} | null> {
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

  try {
    await verifyBundle(bundleDir, againstDir, selection);

    // Lock drift check: compare behavioral settings used at bundle time with
    // the current effective settings. Warn on mismatch; --strict makes it a
    // hard error (enforced by the caller via --strict CLI flag).
    const lockWarnings: string[] = [];
    const lockMismatches: LockSettingMismatch[] = [];

    const projectName = await readProjectNameFromBundle(bundleDir);
    if (projectName !== null) {
      const lock = await readLock(bundleDir, projectName);
      if (lock !== null) {
        const configPath = args.config ?? "cx.toml";
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
