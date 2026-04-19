// test-lane: integration

import fs from "node:fs/promises";
import path from "node:path";
import { describe, expect, test } from "vitest";

import { loadManifestFromBundle } from "../../src/bundle/validate.js";
import { createProject, runQuietBundleCommand } from "./helpers.js";

async function createUpdateMatrixProject(): Promise<{
  root: string;
  configPath: string;
  bundleDir: string;
}> {
  return createProject({
    config: {
      assets: {
        targetDir: "demo-assets",
      },
    },
  });
}

async function readConfig(configPath: string): Promise<string> {
  return fs.readFile(configPath, "utf8");
}

async function writeConfig(
  configPath: string,
  contents: string,
): Promise<void> {
  await fs.writeFile(configPath, contents, "utf8");
}

describe("bundle update matrix", () => {
  test("style-change transition preserves bundle integrity with --update", {
    timeout: 120000,
  }, async () => {
    const project = await createUpdateMatrixProject();
    expect(await runQuietBundleCommand({ config: project.configPath })).toBe(0);
    const originalXml = path.join(
      project.bundleDir,
      "demo-repomix-src.xml.txt",
    );
    expect(await fs.stat(originalXml)).toBeDefined();

    const config = (await readConfig(project.configPath)).replace(
      'style = "xml"',
      'style = "markdown"',
    );
    await writeConfig(project.configPath, config);

    expect(
      await runQuietBundleCommand({ config: project.configPath, update: true }),
    ).toBe(0);
    await expect(fs.stat(originalXml)).rejects.toThrow();
    expect(
      await fs.stat(path.join(project.bundleDir, "demo-repomix-src.md")),
    ).toBeDefined();
  });

  test("section-change transition moves files between sections with --update", {
    timeout: 120000,
  }, async () => {
    const project = await createUpdateMatrixProject();
    expect(await runQuietBundleCommand({ config: project.configPath })).toBe(0);

    const originalConfig = await readConfig(project.configPath);
    const modifiedConfig = originalConfig
      .replace('include = ["README.md", "docs/**"]', 'include = ["docs/**"]')
      .replace(
        "[sections.src]",
        '[sections.repo]\ninclude = ["README.md"]\nexclude = []\n\n[sections.src]',
      );
    await writeConfig(project.configPath, modifiedConfig);

    expect(
      await runQuietBundleCommand({ config: project.configPath, update: true }),
    ).toBe(0);

    const { manifest } = await loadManifestFromBundle(project.bundleDir);
    const repoSection = manifest.sections.find(
      (section) => section.name === "repo",
    );
    const docsSection = manifest.sections.find(
      (section) => section.name === "docs",
    );
    expect(repoSection).toBeDefined();
    expect(docsSection).toBeDefined();
    expect(repoSection?.files.some((file) => file.path === "README.md")).toBe(
      true,
    );
    expect(docsSection?.files.some((file) => file.path === "README.md")).toBe(
      false,
    );
  });

  test("asset-change transition prunes removed assets with --update", {
    timeout: 120000,
  }, async () => {
    const project = await createUpdateMatrixProject();
    expect(await runQuietBundleCommand({ config: project.configPath })).toBe(0);
    const assetPath = path.join(project.bundleDir, "demo-assets", "logo.png");
    expect(await fs.stat(assetPath)).toBeDefined();

    const config = (await readConfig(project.configPath)).replace(
      'include = ["**/*.png"]',
      "include = []",
    );
    await writeConfig(project.configPath, config);

    expect(
      await runQuietBundleCommand({ config: project.configPath, update: true }),
    ).toBe(0);
    await expect(fs.stat(assetPath)).rejects.toThrow();
  });
});
