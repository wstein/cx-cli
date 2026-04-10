import { describe, expect, test } from "bun:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { runBundleCommand } from "../../src/cli/commands/bundle.js";
import { runExtractCommand } from "../../src/cli/commands/extract.js";
import { runListCommand } from "../../src/cli/commands/list.js";
import { runValidateCommand } from "../../src/cli/commands/validate.js";
import { runVerifyCommand } from "../../src/cli/commands/verify.js";
import { sha256File } from "../../src/shared/hashing.js";

async function createProject(): Promise<{
  root: string;
  configPath: string;
  bundleDir: string;
}> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "cx-bundle-"));
  const bundleDir = path.join(root, "dist", "demo-bundle");
  await fs.mkdir(path.join(root, "src"), { recursive: true });
  await fs.mkdir(path.join(root, "docs"), { recursive: true });
  await fs.writeFile(path.join(root, "README.md"), "# Demo\n", "utf8");
  await fs.writeFile(
    path.join(root, "src", "index.ts"),
    "export const demo = 1;\n",
    "utf8",
  );
  await fs.writeFile(path.join(root, "docs", "guide.md"), "hello\n", "utf8");
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
compress = false
remove_comments = false
remove_empty_lines = false
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
target_dir = "{project}-assets"

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

describe("bundle workflow", () => {
  test("creates, validates, lists, and verifies a bundle", async () => {
    const project = await createProject();
    expect(await runBundleCommand({ config: project.configPath })).toBe(0);
    expect(await runValidateCommand({ bundleDir: project.bundleDir })).toBe(0);
    expect(await runVerifyCommand({ bundleDir: project.bundleDir })).toBe(0);

    const writes: string[] = [];
    const stdoutWrite = process.stdout.write;
    process.stdout.write = ((chunk: string | Uint8Array) => {
      writes.push(String(chunk));
      return true;
    }) as typeof process.stdout.write;
    expect(
      await runListCommand({ bundleDir: project.bundleDir, json: false }),
    ).toBe(0);
    process.stdout.write = stdoutWrite;

    expect(writes.join("")).toContain("README.md");
    expect(
      await fs.stat(path.join(project.bundleDir, "demo-manifest.toon")),
    ).toBeDefined();
    expect(
      await fs.stat(path.join(project.bundleDir, "demo.sha256")),
    ).toBeDefined();
  });

  test("round-trips extracted files exactly for xml bundles", async () => {
    const project = await createProject();
    const restoreDir = path.join(project.root, "restored");

    expect(await runBundleCommand({ config: project.configPath })).toBe(0);
    expect(
      await runExtractCommand({
        bundleDir: project.bundleDir,
        destinationDir: restoreDir,
        sections: undefined,
        files: undefined,
        assetsOnly: false,
        overwrite: false,
        verify: true,
      }),
    ).toBe(0);

    for (const relativePath of [
      "README.md",
      "docs/guide.md",
      "src/index.ts",
      "logo.png",
    ]) {
      expect(await sha256File(path.join(restoreDir, relativePath))).toBe(
        await sha256File(path.join(project.root, relativePath)),
      );
    }
  });

  test("round-trips extracted files exactly for json bundles", async () => {
    const project = await createProject();
    const restoreDir = path.join(project.root, "restored-json");
    await fs.writeFile(
      project.configPath,
      (await fs.readFile(project.configPath, "utf8")).replace(
        'style = "xml"',
        'style = "json"',
      ),
      "utf8",
    );

    expect(await runBundleCommand({ config: project.configPath })).toBe(0);
    expect(
      await runExtractCommand({
        bundleDir: project.bundleDir,
        destinationDir: restoreDir,
        sections: undefined,
        files: undefined,
        assetsOnly: false,
        overwrite: false,
        verify: true,
      }),
    ).toBe(0);

    for (const relativePath of [
      "README.md",
      "docs/guide.md",
      "src/index.ts",
      "logo.png",
    ]) {
      expect(await sha256File(path.join(restoreDir, relativePath))).toBe(
        await sha256File(path.join(project.root, relativePath)),
      );
    }
  });

  test("rejects text extraction for bundles created with lossy transforms", async () => {
    const project = await createProject();
    const restoreDir = path.join(project.root, "restored-lossy");
    await fs.writeFile(
      project.configPath,
      (await fs.readFile(project.configPath, "utf8")).replace(
        "remove_empty_lines = false",
        "remove_empty_lines = true",
      ),
      "utf8",
    );

    expect(await runBundleCommand({ config: project.configPath })).toBe(0);
    await expect(
      runExtractCommand({
        bundleDir: project.bundleDir,
        destinationDir: restoreDir,
        sections: undefined,
        files: undefined,
        assetsOnly: false,
        overwrite: false,
        verify: false,
      }),
    ).rejects.toThrow("lossy text transforms");
  });
});
