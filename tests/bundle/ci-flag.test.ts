// test-lane: integration

import fs from "node:fs/promises";
import path from "node:path";
import { describe, expect, test } from "vitest";

import { loadManifestFromBundle } from "../../src/bundle/validate.js";
import { setCLIOverrides } from "../../src/config/env.js";
import { readLock } from "../../src/manifest/lock.js";
import { CxError } from "../../src/shared/errors.js";
import { createProject, runQuietBundleCommand } from "./helpers.js";

async function createAndInitProject(): Promise<{
  root: string;
  configPath: string;
  bundleDir: string;
}> {
  return createProject({
    initializeGit: true,
    config: {
      projectName: "test-ci",
      outputDir: "dist/bundle",
      assets: {
        include: [],
        exclude: [],
        mode: "ignore",
        targetDir: "assets",
      },
      sections: {
        src: {
          include: ["src/**"],
          exclude: [],
        },
      },
    },
    files: {
      "src/index.ts": "export const value = 1;\n",
    },
  });
}

describe("cx bundle --ci / --force dirty-state handling", () => {
  test("clean state: exits 0 without any flags", async () => {
    const { root: _root, configPath } = await createAndInitProject();

    // No modifications to tracked files — state is clean
    const exitCode = await runQuietBundleCommand({
      config: configPath,
    });

    expect(exitCode).toBe(0);
  });

  test("safe_dirty state: exits 0 with untracked files only (no override needed)", async () => {
    const { root, configPath } = await createAndInitProject();

    // Add an untracked file (creates safe_dirty state)
    await fs.writeFile(
      path.join(root, "untracked.txt"),
      "This file is not tracked by git\n",
      "utf8",
    );

    // Bundle without --ci or --force should succeed (safe_dirty is safe)
    const exitCode = await runQuietBundleCommand({
      config: configPath,
    });

    expect(exitCode).toBe(0);
  });

  test("exits 7 on unsafe_dirty without --ci or --force", async () => {
    const { root, configPath } = await createAndInitProject();

    // Modify a tracked file without committing (creates unsafe_dirty state)
    await fs.writeFile(
      path.join(root, "src", "index.ts"),
      "export const value = 2;\n",
      "utf8",
    );

    // Attempt to bundle without --ci or --force should fail with exit code 7
    try {
      await runQuietBundleCommand({
        config: configPath,
      });
      // Should not reach here
      expect.unreachable();
    } catch (error) {
      // Expected: CxError with exit code 7
      expect(error instanceof Error).toBe(true);
      const errorMsg = (error as Error).message;
      expect(errorMsg).toContain("Refusing to bundle");
      expect(error).toBeInstanceOf(CxError);
      expect((error as CxError).remediation?.docsRef).toBe(
        "manual:audited-overrides.adoc",
      );
      expect((error as CxError).remediation?.nextSteps).toContain(
        "Use --force for a local override or --ci for a pipeline override only when you intend to record dirty provenance in the manifest.",
      );
      expect((error as CxError).remediation?.nextSteps).not.toEqual(
        expect.arrayContaining([expect.stringContaining("dedup.mode")]),
      );
      expect((error as CxError).remediation?.scopeHint).toBeUndefined();
    }
  });

  test("--lenient still exits 7 on unsafe_dirty without --ci or --force", async () => {
    const { root, configPath } = await createAndInitProject();

    await fs.writeFile(
      path.join(root, "src", "index.ts"),
      "export const value = 22;\n",
      "utf8",
    );

    setCLIOverrides({
      dedupMode: "warn",
      repomixMissingExtension: "warn",
      configDuplicateEntry: "warn",
    });
    try {
      await runQuietBundleCommand({
        config: configPath,
      });
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(CxError);
      expect((error as CxError).exitCode).toBe(7);
      expect((error as Error).message).toContain("Refusing to bundle");
    } finally {
      setCLIOverrides({});
    }
  });

  test("--ci exits 0 and writes ci_dirty + bundleMode=ci", async () => {
    const { root, configPath, bundleDir } = await createAndInitProject();

    // Modify a tracked file without committing (creates unsafe_dirty state)
    await fs.writeFile(
      path.join(root, "src", "index.ts"),
      "export const value = 3;\n",
      "utf8",
    );

    // Bundle with --ci should succeed
    const exitCode = await runQuietBundleCommand({
      config: configPath,
      ci: true,
    });

    expect(exitCode).toBe(0);

    // Verify manifest has ci_dirty state
    const { manifest } = await loadManifestFromBundle(bundleDir);
    expect(manifest.dirtyState).toBe("ci_dirty");

    // Verify lock has bundleMode=ci
    const lock = await readLock(bundleDir, "test-ci");
    expect(lock).not.toBeNull();
    expect(lock?.bundleMode).toBe("ci");
  });

  test("--force exits 0 and writes forced_dirty + bundleMode=local", async () => {
    const { root, configPath, bundleDir } = await createAndInitProject();

    // Modify a tracked file without committing (creates unsafe_dirty state)
    await fs.writeFile(
      path.join(root, "src", "index.ts"),
      "export const value = 4;\n",
      "utf8",
    );

    // Bundle with --force should succeed
    const exitCode = await runQuietBundleCommand({
      config: configPath,
      force: true,
    });

    expect(exitCode).toBe(0);

    // Verify manifest has forced_dirty state
    const { manifest } = await loadManifestFromBundle(bundleDir);
    expect(manifest.dirtyState).toBe("forced_dirty");

    // Verify lock has bundleMode=local
    const lock = await readLock(bundleDir, "test-ci");
    expect(lock).not.toBeNull();
    expect(lock?.bundleMode).toBe("local");
  });

  test("dirty state taxonomy: clean, safe_dirty, unsafe_dirty paths are distinct", async () => {
    // This test documents the complete taxonomy:
    // - clean: tracked files unmodified, no untracked files → no override needed
    // - safe_dirty: untracked files only, no modified tracked → no override needed
    // - unsafe_dirty: modified tracked files → --force or --ci required
    //
    // See: docs/modules/architecture/pages/implementation-reference.adoc#dirty-state-taxonomy
    expect(true).toBe(true);
  });
});
