import { describe, expect, test } from "bun:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { loadManifestFromBundle } from "../../src/bundle/validate.js";
import { runBundleCommand } from "../../src/cli/commands/bundle.js";
import { runInspectCommand } from "../../src/cli/commands/inspect.js";
import { runListCommand } from "../../src/cli/commands/list.js";
import { runValidateCommand } from "../../src/cli/commands/validate.js";
import { runVerifyCommand } from "../../src/cli/commands/verify.js";
import { MANIFEST_SCHEMA_VERSION } from "../../src/manifest/json.js";
import { sha256File } from "../../src/shared/hashing.js";
import { captureCli } from "../helpers/cli/captureCli.js";
import { createProject, tamperSectionOutput } from "./helpers.js";

describe("bundle workflow", () => {
  test("creates, validates, lists, and verifies a bundle", async () => {
    const project = await createProject();
    const bundleRun = await captureCli({
      run: () => runBundleCommand({ config: project.configPath }),
      captureConsoleLog: true,
    });

    expect(bundleRun.exitCode).toBe(0);
    const summary = bundleRun.logs;
    expect(summary).toContain("Packed tokens");
    expect(summary).toContain("Output tokens");
    expect(summary).toContain("Immutable snapshot");
    expect(summary).toContain("Use MCP");
    expect(await runValidateCommand({ bundleDir: project.bundleDir })).toBe(0);
    expect(await runVerifyCommand({ bundleDir: project.bundleDir })).toBe(0);

    const listRun = await captureCli({
      run: () => runListCommand({ bundleDir: project.bundleDir, json: false }),
    });
    expect(listRun.exitCode).toBe(0);
    expect(listRun.stdout).toContain("README.md");
    expect(listRun.stdout).toContain("docs");
    expect(listRun.stdout).toContain("status");
    expect(listRun.stdout).not.toContain("kind\tsection\tstored_in");

    const bundleIndexPath = path.join(project.bundleDir, "demo-bundle-index.txt");
    expect(await fs.stat(bundleIndexPath)).toBeDefined();
    const bundleIndex = await fs.readFile(bundleIndexPath, "utf8");
    expect(bundleIndex).toContain("cx bundle index");
    expect(bundleIndex).toContain("demo-repomix-docs.xml.txt");
    expect(bundleIndex).toContain("demo-repomix-src.xml.txt");
    expect(await fs.stat(path.join(project.bundleDir, "demo-manifest.json"))).toBeDefined();
    expect(await fs.stat(path.join(project.bundleDir, "demo.sha256"))).toBeDefined();
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
    expect(await runInspectCommand({ config: project.configPath, json: true })).toBe(0);
    const inspectPayload = JSON.parse(writes.pop() ?? "{}") as {
      summary?: { sectionCount?: number; assetCount?: number };
      bundleComparison?: { available?: boolean };
      sections?: Array<{
        files?: Array<{
          relativePath?: string;
          extractability?: { status?: string } | null;
        }>;
      }>;
    };

    expect(await runListCommand({ bundleDir: project.bundleDir, json: true })).toBe(0);
    process.stdout.write = stdoutWrite;
    const listPayload = JSON.parse(writes.pop() ?? "{}") as {
      summary?: { fileCount?: number; textFileCount?: number };
      repomix?: { spanCapability?: string };
      sections?: Array<{ name: string }>;
      files?: Array<{
        path?: string;
        status?: string;
        mtime?: string;
        extractability?: { status?: string; reason?: string };
      }>;
    };

    expect(inspectPayload.summary?.sectionCount).toBe(2);
    expect(inspectPayload.summary?.assetCount).toBe(1);
    expect(
      inspectPayload.sections
        ?.flatMap((section) => section.files ?? [])
        .find((file) => file.relativePath === "src/index.ts")?.extractability
        ?.status,
    ).toBe("intact");
    expect(listPayload.summary?.fileCount).toBe(4);
    expect(listPayload.summary?.textFileCount).toBe(3);
    expect(listPayload.repomix?.spanCapability).toBe("supported");
    expect(listPayload.sections?.map((section) => section.name)).toEqual(["docs", "src"]);
    expect(
      listPayload.files?.every(
        (file) =>
          file.extractability?.status === "intact" ||
          file.extractability?.status === "degraded" ||
          file.extractability?.status === "copied",
      ),
    ).toBe(true);
    expect(listPayload.files?.find((file) => file.path === "src/index.ts")?.status).toBe(
      "intact",
    );
    expect(inspectPayload.bundleComparison?.available).toBe(true);
  });

  test("includes checksum prefixes in inspect JSON for degraded files", async () => {
    const project = await createProject();
    const writes: string[] = [];
    const stdoutWrite = process.stdout.write;
    process.stdout.write = ((chunk: string | Uint8Array) => {
      writes.push(String(chunk));
      return true;
    }) as typeof process.stdout.write;

    try {
      expect(await runBundleCommand({ config: project.configPath })).toBe(0);
      await tamperSectionOutput(
        project.bundleDir,
        "src",
        'export const demo = "================";\n',
        'export const demo = "tampered";\n',
      );
      expect(await runInspectCommand({ config: project.configPath, json: true })).toBe(0);
    } finally {
      process.stdout.write = stdoutWrite;
    }

    const payload = JSON.parse(writes.pop() ?? "{}") as {
      sections?: Array<{
        files?: Array<{
          relativePath?: string;
          extractability?: {
            status?: string;
            reason?: string;
            expectedSha256?: string;
            actualSha256?: string;
          } | null;
        }>;
      }>;
    };

    const degradedFile = payload.sections
      ?.flatMap((section) => section.files ?? [])
      .find((file) => file.relativePath === "src/index.ts");

    expect(degradedFile?.extractability?.status).toBe("degraded");
    expect(degradedFile?.extractability?.reason).toBe("manifest_hash_mismatch");
    expect(degradedFile?.extractability?.expectedSha256).toBeDefined();
    expect(degradedFile?.extractability?.actualSha256).toBeDefined();
  });

  test("renders human inspect output with bundle status vocabulary", async () => {
    const project = await createProject();
    const writes: string[] = [];
    const stdoutWrite = process.stdout.write;
    process.stdout.write = ((chunk: string | Uint8Array) => {
      writes.push(String(chunk));
      return true;
    }) as typeof process.stdout.write;

    expect(await runBundleCommand({ config: project.configPath })).toBe(0);
    expect(await runInspectCommand({ config: project.configPath, json: false })).toBe(0);

    process.stdout.write = stdoutWrite;
    const output = writes.join("");
    expect(output).toContain("bundle_status: available");
    expect(output).toContain("workflow: static snapshot planning");
    expect(output).toContain("mcp: use cx mcp for live workspace exploration");
    expect(output).toContain("intact   src/index.ts");
    expect(output).toContain("copied   logo.png");
  });

  test("shows checksum prefixes in degraded inspect output", async () => {
    const project = await createProject();
    const writes: string[] = [];
    const stdoutWrite = process.stdout.write;
    process.stdout.write = ((chunk: string | Uint8Array) => {
      writes.push(String(chunk));
      return true;
    }) as typeof process.stdout.write;

    try {
      expect(await runBundleCommand({ config: project.configPath })).toBe(0);
      await tamperSectionOutput(
        project.bundleDir,
        "src",
        'export const demo = "================";\n',
        'export const demo = "tampered";\n',
      );
      expect(await runInspectCommand({ config: project.configPath, json: false })).toBe(0);
    } finally {
      process.stdout.write = stdoutWrite;
    }

    const output = writes.join("");
    expect(output).toContain("manifest_hash_mismatch");
    expect(output).toMatch(/expected [a-f0-9]{8}… got [a-f0-9]{8}…/);
  });

  test("renders token breakdown histogram when requested", async () => {
    const project = await createProject();
    const writes: string[] = [];
    const stdoutWrite = process.stdout.write;
    process.stdout.write = ((chunk: string | Uint8Array) => {
      writes.push(String(chunk));
      return true;
    }) as typeof process.stdout.write;

    try {
      expect(
        await runInspectCommand({
          config: project.configPath,
          json: false,
          tokenBreakdown: true,
        }),
      ).toBe(0);
    } finally {
      process.stdout.write = stdoutWrite;
    }

    const output = writes.join("");
    expect(output).toContain("Token breakdown");
    expect(output).toContain("SECTION  TOKENS   SHARE   GRAPH");
    expect(output).toContain("docs");
    expect(output).toContain("src");
    expect(output).toContain("█");
  });

  test("emits structured JSON for bundle and verify automation", async () => {
    const project = await createProject();
    const writes: string[] = [];
    const stdoutWrite = process.stdout.write;
    process.stdout.write = ((chunk: string | Uint8Array) => {
      writes.push(String(chunk));
      return true;
    }) as typeof process.stdout.write;

    expect(await runBundleCommand({ config: project.configPath, json: true })).toBe(0);
    const bundlePayload = JSON.parse(writes.pop() ?? "{}") as {
      checksumFile?: string;
      repomix?: {
        adapterContract?: string;
        compatibilityStrategy?: string;
        packageVersion?: string;
      };
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
      repomix?: { spanCapabilityReason?: string };
    };

    expect(bundlePayload.checksumFile).toBe("demo.sha256");
    expect(bundlePayload.repomix?.adapterContract).toBe("repomix-pack-v1");
    expect(bundlePayload.repomix?.compatibilityStrategy).toBe(
      "core contract with optional structured rendering and span capture",
    );
    expect(bundlePayload.repomix?.packageVersion).toMatch(/^[0-9]+\.[0-9]+\.[0-9]+-cx\.[0-9]+$/);
    expect(verifyPayload.valid).toBe(true);
    expect(verifyPayload.files).toEqual(["src/index.ts"]);
    expect(verifyPayload.repomix?.spanCapabilityReason).toContain("renderWithMap");
  });

  test("emits structured JSON failure payload for checksum omission", async () => {
    const project = await createProject();
    const writes: string[] = [];
    const stdoutWrite = process.stdout.write;
    process.stdout.write = ((chunk: string | Uint8Array) => {
      writes.push(String(chunk));
      return true;
    }) as typeof process.stdout.write;

    expect(await runBundleCommand({ config: project.configPath })).toBe(0);
    const checksumPath = path.join(project.bundleDir, "demo.sha256");
    await fs.writeFile(
      checksumPath,
      (await fs.readFile(checksumPath, "utf8"))
        .split("\n")
        .filter((line) => !line.includes("demo-manifest.json"))
        .join("\n"),
      "utf8",
    );

    expect(await runVerifyCommand({ bundleDir: project.bundleDir, json: true })).toBe(10);
    process.stdout.write = stdoutWrite;

    const payload = JSON.parse(writes.pop() ?? "{}") as {
      valid?: boolean;
      error?: { type?: string; message?: string; path?: string };
    };

    expect(payload.valid).toBe(false);
    expect(payload.error?.type).toBe("checksum_omission");
    expect(payload.error?.path).toBe("demo-manifest.json");
    expect(payload.error?.message).toContain(
      "Checksum file is missing an entry for demo-manifest.json.",
    );
  });

  test("emits structured JSON failure payload for source-tree drift", async () => {
    const project = await createProject();
    const writes: string[] = [];
    const stdoutWrite = process.stdout.write;
    process.stdout.write = ((chunk: string | Uint8Array) => {
      writes.push(String(chunk));
      return true;
    }) as typeof process.stdout.write;

    expect(await runBundleCommand({ config: project.configPath })).toBe(0);
    await fs.writeFile(path.join(project.root, "README.md"), "# Drifted\n", "utf8");

    expect(
      await runVerifyCommand({
        bundleDir: project.bundleDir,
        againstDir: project.root,
        json: true,
      }),
    ).toBe(10);
    process.stdout.write = stdoutWrite;

    const payload = JSON.parse(writes.pop() ?? "{}") as {
      valid?: boolean;
      error?: { type?: string; message?: string; path?: string };
    };

    expect(payload.valid).toBe(false);
    expect(payload.error?.type).toBe("source_tree_drift");
    expect(payload.error?.path).toBe("README.md");
    expect(payload.error?.message).toContain("Source tree mismatch for README.md");
  });

  test("emits detailed JSON for validate automation", async () => {
    const project = await createProject();
    const writes: string[] = [];
    const stdoutWrite = process.stdout.write;
    process.stdout.write = ((chunk: string | Uint8Array) => {
      writes.push(String(chunk));
      return true;
    }) as typeof process.stdout.write;

    expect(await runBundleCommand({ config: project.configPath })).toBe(0);
    expect(await runValidateCommand({ bundleDir: project.bundleDir, json: true })).toBe(0);
    process.stdout.write = stdoutWrite;

    const payload = JSON.parse(writes.pop() ?? "{}") as {
      valid?: boolean;
      checksumFile?: string;
      schemaVersion?: number;
      bundleVersion?: number;
      summary?: {
        manifestName?: string;
        sectionCount?: number;
        fileCount?: number;
      };
    };

    expect(payload.valid).toBe(true);
    expect(payload.checksumFile).toBe("demo.sha256");
    expect(payload.schemaVersion).toBe(MANIFEST_SCHEMA_VERSION);
    expect(payload.bundleVersion).toBe(1);
    expect(payload.summary?.manifestName).toBe("demo-manifest.json");
    expect(payload.summary?.sectionCount).toBe(2);
    expect(payload.summary?.fileCount).toBe(4);
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

  test("--update prunes orphaned outputs after config changes", async () => {
    const project = await createProject();
    expect(await runBundleCommand({ config: project.configPath })).toBe(0);

    const preservedSectionPath = path.join(project.bundleDir, "demo-repomix-src.xml.txt");
    const preservedBefore = await sha256File(preservedSectionPath);
    const orphanedAssetPath = path.join(project.bundleDir, "assets", "logo.png");
    expect(await fs.stat(orphanedAssetPath)).toBeDefined();

    await fs.writeFile(
      project.configPath,
      (await fs.readFile(project.configPath, "utf8")).replace(
        'include = ["**/*.png"]',
        "include = []",
      ),
      "utf8",
    );

    expect(await runBundleCommand({ config: project.configPath, update: true })).toBe(0);

    await expect(fs.stat(orphanedAssetPath)).rejects.toThrow();
    const preservedAfter = await sha256File(preservedSectionPath);
    expect(preservedAfter).toBe(preservedBefore);
  });

  test("--update refuses to prune non-bundle directories", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "cx-update-safety-"));
    await fs.mkdir(path.join(root, "src"), { recursive: true });
    await fs.writeFile(path.join(root, "src", "index.ts"), "export const x = 1;\n", "utf8");
    await fs.writeFile(path.join(root, "README.md"), "# keep\n", "utf8");
    const configPath = path.join(root, "cx.toml");
    await fs.writeFile(
      configPath,
      `schema_version = 1
project_name = "demo"
source_root = "."
output_dir = "."

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

    await expect(runBundleCommand({ config: configPath, update: true })).rejects.toThrow(
      "Refusing --update prune",
    );
    expect(await fs.readFile(path.join(root, "README.md"), "utf8")).toBe("# keep\n");
  });

  test("fails verify --against when the source tree drifts", async () => {
    const project = await createProject();

    expect(await runBundleCommand({ config: project.configPath })).toBe(0);
    await fs.writeFile(path.join(project.root, "README.md"), "# Drifted\n", "utf8");

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

    expect(await runBundleCommand({ config: project.configPath, json: false })).toBe(0);
    await fs.writeFile(path.join(project.root, "README.md"), "# Drifted\n", "utf8");

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

    expect(await runBundleCommand({ config: project.configPath, json: false })).toBe(0);
    await fs.writeFile(path.join(project.root, "README.md"), "# Drifted\n", "utf8");

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

  test("fails verify when the checksum file omits an expected artifact", async () => {
    const project = await createProject();
    const checksumPath = path.join(project.bundleDir, "demo.sha256");

    expect(await runBundleCommand({ config: project.configPath })).toBe(0);
    await fs.writeFile(
      checksumPath,
      (await fs.readFile(checksumPath, "utf8"))
        .split("\n")
        .filter((line) => !line.includes("demo-manifest.json"))
        .join("\n"),
      "utf8",
    );

    await expect(runVerifyCommand({ bundleDir: project.bundleDir, json: false })).rejects.toThrow(
      "Checksum file is missing an entry for demo-manifest.json.",
    );
  });

  test("rejects bundles with multiple manifest files", async () => {
    const project = await createProject();

    expect(await runBundleCommand({ config: project.configPath })).toBe(0);
    await fs.copyFile(
      path.join(project.bundleDir, "demo-manifest.json"),
      path.join(project.bundleDir, "demo-copy-manifest.json"),
    );

    await expect(loadManifestFromBundle(project.bundleDir)).rejects.toThrow(
      "Bundle must contain exactly one manifest file, found 2.",
    );
  });
});
