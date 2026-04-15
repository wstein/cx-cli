import { describe, expect, test } from "bun:test";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import { loadManifestFromBundle } from "../../src/bundle/validate.js";
import { runBundleCommand } from "../../src/cli/commands/bundle.js";
import { readLock } from "../../src/manifest/lock.js";

const execFileAsync = promisify(execFile);

async function initGitRepo(root: string): Promise<void> {
  await execFileAsync("git", ["init", "-q"], { cwd: root });
  await execFileAsync("git", ["config", "user.email", "cx@example.com"], {
    cwd: root,
  });
  await execFileAsync("git", ["config", "user.name", "cx"], { cwd: root });
  await execFileAsync("git", ["add", "."], { cwd: root });
  await execFileAsync("git", ["commit", "-q", "-m", "init"], { cwd: root });
}

async function createAndInitProject(): Promise<{
  root: string;
  configPath: string;
  bundleDir: string;
}> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "cx-ci-flag-"));
  await fs.mkdir(path.join(root, "src"), { recursive: true });
  await fs.writeFile(
    path.join(root, "src", "index.ts"),
    "export const value = 1;\n",
    "utf8",
  );

  const bundleDir = path.join(root, "dist", "bundle");
  const configPath = path.join(root, "cx.toml");
  await fs.writeFile(
    configPath,
    `schema_version = 1
project_name = "test-ci"
source_root = "."
output_dir = "dist/bundle"

[repomix]
style = "xml"
show_line_numbers = false
include_empty_directories = false
security_check = false

[files]
exclude = ["dist/**"]
follow_symlinks = false
unmatched = "ignore"

[sections.src]
include = ["src/**"]
exclude = []
`,
    "utf8",
  );

  await initGitRepo(root);

  return { root, configPath, bundleDir };
}

describe("cx bundle --ci / --force dirty-state handling", () => {
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
      await runBundleCommand({
        config: configPath,
        output: undefined,
        ci: undefined,
        force: undefined,
      });
      // Should not reach here
      expect.unreachable();
    } catch (error) {
      // Expected: CxError with exit code 7
      expect(error instanceof Error).toBe(true);
      const errorMsg = (error as Error).message;
      expect(errorMsg).toContain("Refusing to bundle");
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
    const exitCode = await runBundleCommand({
      config: configPath,
      output: undefined,
      ci: true,
      force: undefined,
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
    const exitCode = await runBundleCommand({
      config: configPath,
      output: undefined,
      ci: undefined,
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
});
