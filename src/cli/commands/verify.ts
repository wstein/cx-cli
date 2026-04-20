import path from "node:path";
import { getAdapterCapabilities } from "../../adapter/capabilities.js";
import { loadManifestFromBundle } from "../../bundle/validate.js";
import { VerifyError, verifyBundle } from "../../bundle/verify.js";
import { getCLIOverrides, readEnvOverrides } from "../../config/env.js";
import { loadCxConfig } from "../../config/load.js";
import {
  type CurrentBehaviorSnapshot,
  diffLockSettings,
  type LockSettingMismatch,
  readLock,
} from "../../manifest/lock.js";
import { CxError, getErrorRemediation } from "../../shared/errors.js";
import {
  printDivider,
  printHeader,
  printSuccess,
  printTable,
} from "../../shared/format.js";
import { pathExists } from "../../shared/fs.js";
import {
  type CommandIo,
  resolveCommandIo,
  writeStderr,
  writeValidatedJson,
} from "../../shared/output.js";
import type { DirtyState } from "../../vcs/provider.js";
import { VerifyCommandJsonSchema } from "../jsonContracts.js";

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
  emitBehaviorLogs = true,
): Promise<CurrentBehaviorSnapshot | null> {
  if (!(await pathExists(configPath))) return null;

  try {
    const config = await loadCxConfig(
      configPath,
      readEnvOverrides(),
      getCLIOverrides(),
      { emitBehaviorLogs },
    );
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

export async function runVerifyCommand(
  args: VerifyArgs,
  ioArg: Partial<CommandIo> = {},
): Promise<number> {
  const io = resolveCommandIo(ioArg);
  const bundleDir = path.resolve(io.cwd, args.bundleDir);
  const againstDir = args.againstDir
    ? path.resolve(io.cwd, args.againstDir)
    : undefined;
  const selection = {
    sections: args.sections,
    files: args.files,
  };
  const configPath = path.resolve(io.cwd, args.config ?? "cx.toml");
  const againstConfig = againstDir
    ? await loadCxConfig(
        configPath,
        readEnvOverrides(io.env),
        getCLIOverrides(),
        { emitBehaviorLogs: io.emitBehaviorLogs },
      )
    : undefined;

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
      writeStderr(`Warning: ${msg}\n`, io);
    } else if (manifestDirtyState === "forced_dirty") {
      const msg =
        "Bundle was created with --force while tracked files had uncommitted changes (forced_dirty).";
      lockWarnings.push(msg);
      writeStderr(`Warning: ${msg}\n`, io);
    }

    // Lock drift check: compare behavioral settings used at bundle time with
    // the current effective settings. Warn on mismatch; --strict makes it a
    // hard error (enforced by the caller via --strict CLI flag).
    const lockMismatches: LockSettingMismatch[] = [];

    if (projectName !== null) {
      const lock = await readLock(bundleDir, projectName);
      if (lock !== null) {
        bundleMode = lock.bundleMode ?? null;

        const current = await buildCurrentSnapshot(
          configPath,
          io.emitBehaviorLogs,
        );
        if (current !== null) {
          const mismatches = diffLockSettings(lock, current);
          for (const m of mismatches) {
            const msg =
              `Behavioral setting drift: ${m.setting} was "${m.locked}" ` +
              `(${m.lockedSource}) at bundle time, now "${m.current}" (${m.currentSource}).`;
            lockWarnings.push(msg);
            writeStderr(`Warning: ${msg}\n`, io);
          }
          lockMismatches.push(...mismatches);
        }
      }
    }

    // Emit bundleMode as info for audit visibility
    if (bundleMode !== null) {
      writeStderr(`Info: bundleMode=${bundleMode}\n`, io);
    }

    if (!(args.json ?? false)) {
      printHeader("Verification Complete", io);
      printTable([["Bundle", bundleDir]], io);
      if (againstDir) {
        printTable([["Against", againstDir]], io);
      }
      printDivider(io);
      printSuccess("Bundle is valid", io);
    }

    if (args.json ?? false) {
      writeValidatedJson(
        VerifyCommandJsonSchema,
        {
          bundleDir,
          againstDir: againstDir ?? null,
          sections: args.sections ?? [],
          files: args.files ?? [],
          adapter: await getAdapterCapabilities(),
          valid: true,
          dirtyState: manifestDirtyState,
          bundleMode: bundleMode,
          warnings: lockWarnings,
          lockDrift: lockMismatches.length > 0 ? lockMismatches : null,
        },
        io,
      );
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
        adapter: Awaited<ReturnType<typeof getAdapterCapabilities>>;
        valid: false;
        dirtyState: DirtyState | null;
        bundleMode: string | null;
        error: {
          type?: string;
          message: string;
          path?: string;
          remediation?:
            | import("../../shared/errors.js").ErrorRemediation
            | null;
        };
      } = {
        bundleDir,
        againstDir: againstDir ?? null,
        sections: args.sections ?? [],
        files: args.files ?? [],
        adapter: await getAdapterCapabilities(),
        valid: false,
        dirtyState: manifestDirtyState,
        bundleMode: bundleMode,
        error: {
          message: resolvedError.message,
          remediation: getErrorRemediation(error) ?? null,
        },
      };

      if (error instanceof VerifyError) {
        payload.error.type = error.type;
        if (error.relativePath) {
          payload.error.path = error.relativePath;
        }
      }

      writeValidatedJson(VerifyCommandJsonSchema, payload, io);
      return error instanceof CxError ? error.exitCode : 1;
    }

    throw error;
  }
}
