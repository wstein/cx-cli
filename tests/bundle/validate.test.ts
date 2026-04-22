// test-lane: integration

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, test } from "vitest";

import {
  loadManifestFromBundle,
  validateBundle,
} from "../../src/bundle/validate.js";
import {
  createProject,
  runQuietBundleCommand,
  seedAntoraDocs,
} from "./helpers.js";

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
    expect(await runQuietBundleCommand({ config: project.configPath })).toBe(0);
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
    expect(await runQuietBundleCommand({ config: project.configPath })).toBe(0);

    await fs.rm(path.join(project.bundleDir, "demo-src.xml.txt"));

    await expect(validateBundle(project.bundleDir)).rejects.toThrow(
      "Bundle is missing section output demo-src.xml.txt.",
    );
  });

  test("rejects missing shared handover files", async () => {
    const project = await createProject();
    expect(await runQuietBundleCommand({ config: project.configPath })).toBe(0);

    const { manifest } = await loadManifestFromBundle(project.bundleDir);
    expect(manifest.handoverFile).toBeDefined();
    if (manifest.handoverFile === undefined) {
      throw new Error("Expected shared handover file in manifest");
    }

    await fs.rm(path.join(project.bundleDir, manifest.handoverFile));

    await expect(validateBundle(project.bundleDir)).rejects.toThrow(
      `Bundle is missing shared handover ${manifest.handoverFile}.`,
    );
  });

  test("rejects missing assets", async () => {
    const project = await createProject();
    expect(await runQuietBundleCommand({ config: project.configPath })).toBe(0);

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

  test("rejects missing derived review exports", async () => {
    const project = await createProject();
    await seedAntoraDocs(project.root);
    expect(
      await runQuietBundleCommand({
        config: project.configPath,
        includeDocExports: true,
      }),
    ).toBe(0);

    const { manifest } = await loadManifestFromBundle(project.bundleDir);
    const exportPath = manifest.derivedReviewExports?.[0]?.storedPath;
    expect(exportPath).toBeDefined();
    if (exportPath === undefined) {
      throw new Error("Expected derived review export in manifest");
    }

    await fs.rm(path.join(project.bundleDir, exportPath));

    await expect(validateBundle(project.bundleDir)).rejects.toThrow(
      `Bundle is missing derived review export ${exportPath}.`,
    );
  });

  test("rejects missing checksum files", async () => {
    const project = await createProject();
    expect(await runQuietBundleCommand({ config: project.configPath })).toBe(0);

    const { manifest } = await loadManifestFromBundle(project.bundleDir);
    await fs.rm(path.join(project.bundleDir, manifest.checksumFile));

    await expect(validateBundle(project.bundleDir)).rejects.toThrow(
      `Bundle is missing checksum file ${manifest.checksumFile}.`,
    );
  });

  test("rejects invalid json section outputs in json bundles", async () => {
    const project = await createProject({
      config: {
        repomix: {
          style: "json",
        },
      },
    });
    expect(await runQuietBundleCommand({ config: project.configPath })).toBe(0);

    await fs.writeFile(
      path.join(project.bundleDir, "demo-src.json.txt"),
      '{"broken":true}\n',
      "utf8",
    );

    await expect(validateBundle(project.bundleDir)).rejects.toThrow(
      "Bundle contains invalid JSON section output demo-src.json.txt:",
    );
  });

  test("rejects invalid json shared handovers in json bundles", async () => {
    const project = await createProject({
      config: {
        repomix: {
          style: "json",
        },
      },
    });
    expect(await runQuietBundleCommand({ config: project.configPath })).toBe(0);

    const { manifest } = await loadManifestFromBundle(project.bundleDir);
    await fs.writeFile(
      path.join(
        project.bundleDir,
        manifest.handoverFile ?? "demo-handover.json.txt",
      ),
      '{"broken":true}\n',
      "utf8",
    );

    await expect(validateBundle(project.bundleDir)).rejects.toThrow(
      "Bundle contains invalid JSON shared handover",
    );
  });
});
