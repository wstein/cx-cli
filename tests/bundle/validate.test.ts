// test-lane: integration

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, test } from "vitest";

import {
  loadManifestFromBundle,
  validateBundle,
} from "../../src/bundle/validate.js";
import { runBundleCommand } from "../../src/cli/commands/bundle.js";
import { createProject } from "./helpers.js";

describe("bundle validation", () => {
  test("rejects bundles missing a manifest file", async () => {
    const tempDir = await fs.mkdtemp(
      path.join(os.tmpdir(), "cx-validate-missing-manifest-"),
    );

    await expect(loadManifestFromBundle(tempDir)).rejects.toThrow(
      "Bundle is missing a manifest file.",
    );
  });

  test("rejects bundles with multiple manifest files", async () => {
    const tempDir = await fs.mkdtemp(
      path.join(os.tmpdir(), "cx-validate-multi-manifest-"),
    );

    await fs.writeFile(path.join(tempDir, "one-manifest.json"), "{}", "utf8");
    await fs.writeFile(path.join(tempDir, "two-manifest.json"), "{}", "utf8");

    await expect(loadManifestFromBundle(tempDir)).rejects.toThrow(
      "Bundle must contain exactly one manifest file, found 2.",
    );
  });

  test("rejects unsupported bundle versions", async () => {
    const project = await createProject();
    expect(await runBundleCommand({ config: project.configPath })).toBe(0);
    const manifest = await loadManifestFromBundle(project.bundleDir);

    await expect(
      validateBundle("/unused", {
        loadManifestFromBundle: async () => ({
          manifest: { ...manifest.manifest, bundleVersion: 2 as unknown as 1 },
          manifestName: manifest.manifestName,
        }),
      }),
    ).rejects.toThrow(
      "Unsupported bundle version 2. This version of cx supports bundle version 1.",
    );
  });

  test("rejects missing section outputs", async () => {
    const project = await createProject();
    expect(await runBundleCommand({ config: project.configPath })).toBe(0);

    await fs.rm(path.join(project.bundleDir, "demo-repomix-src.xml.txt"));

    await expect(validateBundle(project.bundleDir)).rejects.toThrow(
      "Bundle is missing section output demo-repomix-src.xml.txt.",
    );
  });

  test("rejects missing bundle index files", async () => {
    const project = await createProject();
    expect(await runBundleCommand({ config: project.configPath })).toBe(0);

    const { manifest } = await loadManifestFromBundle(project.bundleDir);
    expect(manifest.bundleIndexFile).toBeDefined();
    if (manifest.bundleIndexFile === undefined) {
      throw new Error("Expected bundle index file in manifest");
    }

    await fs.rm(path.join(project.bundleDir, manifest.bundleIndexFile));

    await expect(validateBundle(project.bundleDir)).rejects.toThrow(
      `Bundle is missing bundle index ${manifest.bundleIndexFile}.`,
    );
  });

  test("rejects missing assets", async () => {
    const project = await createProject();
    expect(await runBundleCommand({ config: project.configPath })).toBe(0);

    const { manifest } = await loadManifestFromBundle(project.bundleDir);
    const assetPath = manifest.assets[0]?.storedPath;
    expect(assetPath).toBeDefined();
    if (assetPath === undefined) {
      throw new Error("Expected bundled asset in manifest");
    }

    await fs.rm(path.join(project.bundleDir, assetPath));

    await expect(validateBundle(project.bundleDir)).rejects.toThrow(
      `Bundle is missing asset ${assetPath}.`,
    );
  });

  test("rejects missing checksum files", async () => {
    const project = await createProject();
    expect(await runBundleCommand({ config: project.configPath })).toBe(0);

    const { manifest } = await loadManifestFromBundle(project.bundleDir);
    await fs.rm(path.join(project.bundleDir, manifest.checksumFile));

    await expect(validateBundle(project.bundleDir)).rejects.toThrow(
      `Bundle is missing checksum file ${manifest.checksumFile}.`,
    );
  });
});
