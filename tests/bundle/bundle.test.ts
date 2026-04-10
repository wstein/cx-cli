import { describe, expect, test } from "bun:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { runBundleCommand } from "../../src/cli/commands/bundle.js";
import { runExtractCommand } from "../../src/cli/commands/extract.js";
import { runInspectCommand } from "../../src/cli/commands/inspect.js";
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
  await fs.writeFile(
    path.join(root, "README.md"),
    "# Demo\n\n```\ncode fence\n```\n",
    "utf8",
  );
  await fs.writeFile(
    path.join(root, "src", "index.ts"),
    'export const demo = "================";\n',
    "utf8",
  );
  await fs.writeFile(
    path.join(root, "docs", "guide.md"),
    "hello\n================\nstill content\n",
    "utf8",
  );
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

  test("emits structured JSON for list and inspect automation", async () => {
    const project = await createProject();
    const writes: string[] = [];
    const stdoutWrite = process.stdout.write;
    process.stdout.write = ((chunk: string | Uint8Array) => {
      writes.push(String(chunk));
      return true;
    }) as typeof process.stdout.write;

    expect(await runBundleCommand({ config: project.configPath })).toBe(0);
    expect(
      await runInspectCommand({ config: project.configPath, json: true }),
    ).toBe(0);
    const inspectPayload = JSON.parse(writes.pop() ?? "{}") as {
      summary?: { sectionCount?: number; assetCount?: number };
    };

    expect(
      await runListCommand({ bundleDir: project.bundleDir, json: true }),
    ).toBe(0);
    process.stdout.write = stdoutWrite;
    const listPayload = JSON.parse(writes.pop() ?? "{}") as {
      summary?: { fileCount?: number; textFileCount?: number };
      repomix?: { exactSpanCaptureSupported?: boolean };
      sections?: Array<{ name: string }>;
    };

    expect(inspectPayload.summary?.sectionCount).toBe(2);
    expect(inspectPayload.summary?.assetCount).toBe(1);
    expect(listPayload.summary?.fileCount).toBe(4);
    expect(listPayload.summary?.textFileCount).toBe(3);
    expect(listPayload.repomix?.exactSpanCaptureSupported).toBe(false);
    expect(listPayload.sections?.map((section) => section.name)).toEqual([
      "docs",
      "src",
    ]);
  });

  test("emits structured JSON for bundle and verify automation", async () => {
    const project = await createProject();
    const writes: string[] = [];
    const stdoutWrite = process.stdout.write;
    process.stdout.write = ((chunk: string | Uint8Array) => {
      writes.push(String(chunk));
      return true;
    }) as typeof process.stdout.write;

    expect(
      await runBundleCommand({ config: project.configPath, json: true }),
    ).toBe(0);
    const bundlePayload = JSON.parse(writes.pop() ?? "{}") as {
      checksumFile?: string;
      repomix?: { supportedRepomixVersion?: string };
    };

    expect(
      await runVerifyCommand({
        bundleDir: project.bundleDir,
        againstDir: project.root,
        files: ["src/index.ts"],
        json: true,
        sections: undefined,
      }),
    ).toBe(0);
    process.stdout.write = stdoutWrite;

    const verifyPayload = JSON.parse(writes.pop() ?? "{}") as {
      valid?: boolean;
      files?: string[];
      repomix?: { exactSpanCaptureReason?: string };
    };

    expect(bundlePayload.checksumFile).toBe("demo.sha256");
    expect(bundlePayload.repomix?.supportedRepomixVersion).toBe("1.13.1");
    expect(verifyPayload.valid).toBe(true);
    expect(verifyPayload.files).toEqual(["src/index.ts"]);
    expect(verifyPayload.repomix?.exactSpanCaptureReason).toContain(
      "public exports",
    );
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

  test("round-trips extracted files exactly for markdown bundles", async () => {
    const project = await createProject();
    const restoreDir = path.join(project.root, "restored-markdown");
    await fs.writeFile(
      project.configPath,
      (await fs.readFile(project.configPath, "utf8")).replace(
        'style = "xml"',
        'style = "markdown"',
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

  test("round-trips extracted files exactly for plain bundles", async () => {
    const project = await createProject();
    const restoreDir = path.join(project.root, "restored-plain");
    await fs.writeFile(
      project.configPath,
      (await fs.readFile(project.configPath, "utf8")).replace(
        'style = "xml"',
        'style = "plain"',
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

  test("verifies a bundle against the original source tree", async () => {
    const project = await createProject();

    expect(await runBundleCommand({ config: project.configPath })).toBe(0);
    expect(
      await runVerifyCommand({
        bundleDir: project.bundleDir,
        againstDir: project.root,
        files: undefined,
        json: false,
        sections: undefined,
      }),
    ).toBe(0);
  });

  test("fails verify --against when the source tree drifts", async () => {
    const project = await createProject();

    expect(await runBundleCommand({ config: project.configPath })).toBe(0);
    await fs.writeFile(
      path.join(project.root, "README.md"),
      "# Drifted\n",
      "utf8",
    );

    await expect(
      runVerifyCommand({
        bundleDir: project.bundleDir,
        againstDir: project.root,
        files: undefined,
        json: false,
        sections: undefined,
      }),
    ).rejects.toThrow("Source tree mismatch");
  });

  test("supports selective verify --against by file", async () => {
    const project = await createProject();

    expect(
      await runBundleCommand({ config: project.configPath, json: false }),
    ).toBe(0);
    await fs.writeFile(
      path.join(project.root, "README.md"),
      "# Drifted\n",
      "utf8",
    );

    expect(
      await runVerifyCommand({
        bundleDir: project.bundleDir,
        againstDir: project.root,
        files: ["src/index.ts"],
        json: false,
        sections: undefined,
      }),
    ).toBe(0);

    await expect(
      runVerifyCommand({
        bundleDir: project.bundleDir,
        againstDir: project.root,
        files: ["README.md"],
        json: false,
        sections: undefined,
      }),
    ).rejects.toThrow("Source tree mismatch");
  });

  test("supports selective verify --against by section", async () => {
    const project = await createProject();

    expect(
      await runBundleCommand({ config: project.configPath, json: false }),
    ).toBe(0);
    await fs.writeFile(
      path.join(project.root, "README.md"),
      "# Drifted\n",
      "utf8",
    );

    expect(
      await runVerifyCommand({
        bundleDir: project.bundleDir,
        againstDir: project.root,
        files: undefined,
        json: false,
        sections: ["src"],
      }),
    ).toBe(0);

    await expect(
      runVerifyCommand({
        bundleDir: project.bundleDir,
        againstDir: project.root,
        files: undefined,
        json: false,
        sections: ["docs"],
      }),
    ).rejects.toThrow("Source tree mismatch");
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
