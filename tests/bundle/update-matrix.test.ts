import { describe, expect, test } from "bun:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { loadManifestFromBundle } from "../../src/bundle/validate.js";
import { runBundleCommand } from "../../src/cli/commands/bundle.js";

async function createProject(): Promise<{
  root: string;
  configPath: string;
  bundleDir: string;
}> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "cx-update-matrix-"));
  const bundleDir = path.join(root, "dist", "demo-bundle");
  await fs.mkdir(path.join(root, "src"), { recursive: true });
  await fs.mkdir(path.join(root, "docs"), { recursive: true });
  await fs.writeFile(
    path.join(root, "README.md"),
    "# Demo\n\nHello world\n",
    "utf8",
  );
  await fs.writeFile(
    path.join(root, "src", "index.ts"),
    "export const demo = 1;\n",
    "utf8",
  );
  await fs.writeFile(path.join(root, "docs", "guide.md"), "# Guide\n", "utf8");
  await fs.writeFile(path.join(root, "logo.png"), "fakepng", "utf8");
  const configPath = path.join(root, "cx.toml");
  await fs.writeFile(
    configPath,
    `schema_version = 1
project_name = "demo"
source_root = "."
output_dir = "dist/demo-bundle"

[repomix]
style = "xml"
show_line_numbers = false
include_empty_directories = false
security_check = false

[files]
exclude = ["dist/**"]
follow_symlinks = false
unmatched = "ignore"

[assets]
include = ["**/*.png"]
exclude = []
mode = "copy"
target_dir = "assets"
layout = "flat"

[sections.docs]
include = ["README.md", "docs/**"]
exclude = []

[sections.src]
include = ["src/**"]
exclude = []
`,
    "utf8",
  );
  return { root, configPath, bundleDir };
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
  test("style-change transition preserves bundle integrity with --update", async () => {
    const project = await createProject();
    expect(await runBundleCommand({ config: project.configPath })).toBe(0);
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
      await runBundleCommand({ config: project.configPath, update: true }),
    ).toBe(0);
    await expect(fs.stat(originalXml)).rejects.toThrow();
    expect(
      await fs.stat(path.join(project.bundleDir, "demo-repomix-src.md")),
    ).toBeDefined();
  });

  test("section-change transition moves files between sections with --update", async () => {
    const project = await createProject();
    expect(await runBundleCommand({ config: project.configPath })).toBe(0);

    const originalConfig = await readConfig(project.configPath);
    const modifiedConfig = originalConfig
      .replace('include = ["README.md", "docs/**"]', 'include = ["docs/**"]')
      .replace(
        "[sections.src]",
        '[sections.repo]\ninclude = ["README.md"]\nexclude = []\n\n[sections.src]',
      );
    await writeConfig(project.configPath, modifiedConfig);

    expect(
      await runBundleCommand({ config: project.configPath, update: true }),
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

  test("asset-change transition prunes removed assets with --update", async () => {
    const project = await createProject();
    expect(await runBundleCommand({ config: project.configPath })).toBe(0);
    const assetPath = path.join(project.bundleDir, "demo-assets", "logo.png");
    expect(await fs.stat(assetPath)).toBeDefined();

    const config = (await readConfig(project.configPath)).replace(
      'include = ["**/*.png"]',
      "include = []",
    );
    await writeConfig(project.configPath, config);

    expect(
      await runBundleCommand({ config: project.configPath, update: true }),
    ).toBe(0);
    await expect(fs.stat(assetPath)).rejects.toThrow();
  });
});
