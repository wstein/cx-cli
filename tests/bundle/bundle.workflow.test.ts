// test-lane: integration

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, test } from "vitest";

import { loadManifestFromBundle } from "../../src/bundle/validate.js";
import { runBundleCommand } from "../../src/cli/commands/bundle.js";
import { runInspectCommand } from "../../src/cli/commands/inspect.js";
import { runListCommand } from "../../src/cli/commands/list.js";
import { runValidateCommand } from "../../src/cli/commands/validate.js";
import { runVerifyCommand } from "../../src/cli/commands/verify.js";
import { MANIFEST_SCHEMA_VERSION } from "../../src/manifest/json.js";
import { sha256File } from "../../src/shared/hashing.js";
import { createBufferedCommandIo } from "../helpers/cli/createBufferedCommandIo.js";
import { parseJsonOutput } from "../helpers/cli/parseJsonOutput.js";
import {
  createProject,
  runQuietBundleCommand,
  runQuietValidateCommand,
  runQuietVerifyCommand,
  seedAntoraDocs,
  tamperSectionOutput,
} from "./helpers.js";

type ProjectFixture = Awaited<ReturnType<typeof createProject>>;

type BundledProjectFixture = {
  project: ProjectFixture;
  bundleCapture: ReturnType<typeof createBufferedCommandIo>;
};

async function createBundledProjectFixture(
  options?: Parameters<typeof createProject>[0],
): Promise<BundledProjectFixture> {
  const project = await createProject(options);
  const bundleCapture = createBufferedCommandIo();
  const bundleExitCode = await runBundleCommand(
    { config: project.configPath },
    bundleCapture.io,
  );
  expect(bundleExitCode).toBe(0);

  return { project, bundleCapture };
}

describe("bundle workflow", () => {
  let bundledProjectPromise: Promise<BundledProjectFixture> | undefined;
  let bundledLinkedNotesProjectPromise:
    | Promise<BundledProjectFixture>
    | undefined;
  let driftedBundledProjectPromise: Promise<ProjectFixture> | undefined;

  function bundledProject(): Promise<BundledProjectFixture> {
    bundledProjectPromise ??= createBundledProjectFixture();
    return bundledProjectPromise;
  }

  function bundledLinkedNotesProject(): Promise<BundledProjectFixture> {
    bundledLinkedNotesProjectPromise ??= createBundledProjectFixture({
      includeLinkedNotes: true,
    });
    return bundledLinkedNotesProjectPromise;
  }

  async function createDriftedBundledProjectFixture(): Promise<ProjectFixture> {
    const project = await createProject();
    expect(await runQuietBundleCommand({ config: project.configPath })).toBe(0);
    await fs.writeFile(
      path.join(project.root, "README.md"),
      "# Drifted\n",
      "utf8",
    );
    return project;
  }

  function driftedBundledProject(): Promise<ProjectFixture> {
    driftedBundledProjectPromise ??= createDriftedBundledProjectFixture();
    return driftedBundledProjectPromise;
  }

  test("creates, validates, lists, and verifies a bundle", async () => {
    const { project, bundleCapture } = await bundledProject();
    const summary = bundleCapture.logs();
    expect(summary).toContain("Packed tokens");
    expect(summary).toContain("Output tokens");
    expect(summary).toContain("Immutable snapshot");
    expect(summary).toContain("Use MCP");
    expect(
      await runQuietValidateCommand({ bundleDir: project.bundleDir }),
    ).toBe(0);
    expect(await runQuietVerifyCommand({ bundleDir: project.bundleDir })).toBe(
      0,
    );

    const listCapture = createBufferedCommandIo();
    expect(
      await runListCommand(
        { bundleDir: project.bundleDir, json: false },
        listCapture.io,
      ),
    ).toBe(0);
    expect(listCapture.stdout()).toContain("README.md");
    expect(listCapture.stdout()).toContain("docs");
    expect(listCapture.stdout()).toContain("status");
    expect(listCapture.stdout()).not.toContain("kind\tsection\tstored_in");

    const bundleIndexPath = path.join(
      project.bundleDir,
      "demo-handover.xml.txt",
    );
    expect(await fs.stat(bundleIndexPath)).toBeDefined();
    const bundleIndex = await fs.readFile(bundleIndexPath, "utf8");
    expect(bundleIndex).toContain("cx shared handover");
    expect(bundleIndex).toContain("<section_inventory>");
    expect(bundleIndex).toContain("demo-docs.xml.txt");
    expect(bundleIndex).toContain("demo-src.xml.txt");
    const docsOutput = await fs.readFile(
      path.join(project.bundleDir, "demo-docs.xml.txt"),
      "utf8",
    );
    expect(docsOutput).toContain(
      "artifact: deterministic section snapshot for human and AI review.",
    );
    expect(docsOutput).toContain("<authoritative_semantics>");
    expect(docsOutput).toContain(
      "cx-meta, cx-policy, archive markers, manifests, and validation rules remain canonical.",
    );
    expect(
      await fs.stat(path.join(project.bundleDir, "demo-manifest.json")),
    ).toBeDefined();
    expect(
      await fs.stat(path.join(project.bundleDir, "demo.sha256")),
    ).toBeDefined();
  });

  test("adds derived docs review exports when --include-doc-exports is enabled", async () => {
    const project = await createProject();
    await seedAntoraDocs(project.root);
    const capture = createBufferedCommandIo({ cwd: project.root });

    await expect(
      runBundleCommand(
        {
          config: project.configPath,
          json: true,
          includeDocExports: true,
        },
        capture.io,
      ),
    ).resolves.toBe(0);

    const payload = parseJsonOutput<{
      derivedReviewExports?: Array<{
        surfaceName?: string;
        storedPath?: string;
      }>;
    }>(capture.stdout());
    expect(payload.derivedReviewExports).toHaveLength(3);

    const { manifest } = await loadManifestFromBundle(project.bundleDir);
    expect(manifest.derivedReviewExports).toHaveLength(3);
    expect(
      manifest.derivedReviewExports?.map((artifact) => artifact.storedPath),
    ).toEqual([
      "demo-docs-exports/architecture.mmd.txt",
      "demo-docs-exports/manual.mmd.txt",
      "demo-docs-exports/onboarding.mmd.txt",
    ]);

    for (const artifact of manifest.derivedReviewExports ?? []) {
      expect(
        await fs.stat(path.join(project.bundleDir, artifact.storedPath)),
      ).toBeDefined();
    }

    const onboardingExport = await fs.readFile(
      path.join(project.bundleDir, "demo-docs-exports", "onboarding.mmd.txt"),
      "utf8",
    );
    expect(onboardingExport).toContain("(manual.mmd.txt#release-checklist)");
    expect(onboardingExport).toContain(
      "(repository/docs/governance.html#mcp-tool-stability)",
    );
    expect(onboardingExport).not.toContain("ROOT:page$");
    expect(onboardingExport).not.toContain("manual:release-and-integrity.html");

    const checksum = await fs.readFile(
      path.join(project.bundleDir, manifest.checksumFile),
      "utf8",
    );
    expect(checksum).toContain("demo-docs-exports/architecture.mmd.txt");
    expect(checksum).toContain("demo-docs-exports/manual.mmd.txt");
    expect(checksum).toContain("demo-docs-exports/onboarding.mmd.txt");
  });

  test("uses docs.target_dir for bundled derived docs review exports", async () => {
    const project = await createProject({
      config: {
        docs: {
          targetDir: "review-docs",
        },
      },
    });
    await seedAntoraDocs(project.root);

    expect(
      await runQuietBundleCommand({
        config: project.configPath,
        includeDocExports: true,
      }),
    ).toBe(0);

    const { manifest } = await loadManifestFromBundle(project.bundleDir);
    expect(
      manifest.derivedReviewExports?.map((artifact) => artifact.storedPath),
    ).toEqual([
      "review-docs/architecture.mmd.txt",
      "review-docs/manual.mmd.txt",
      "review-docs/onboarding.mmd.txt",
    ]);
  });

  test("surfaces derived docs review exports through inspect and list", async () => {
    const project = await createProject();
    await seedAntoraDocs(project.root);
    expect(
      await runQuietBundleCommand({
        config: project.configPath,
        includeDocExports: true,
      }),
    ).toBe(0);

    const inspectCapture = createBufferedCommandIo({ cwd: project.root });
    expect(
      await runInspectCommand(
        { config: project.configPath, json: true },
        inspectCapture.io,
      ),
    ).toBe(0);
    const inspectPayload = parseJsonOutput<{
      summary?: { derivedReviewExportCount?: number };
      derivedReviewExports?: Array<{
        storedPath?: string;
        extractability?: { status?: string };
      }>;
    }>(inspectCapture.stdout());
    expect(inspectPayload.summary?.derivedReviewExportCount).toBe(3);
    expect(inspectPayload.derivedReviewExports).toHaveLength(3);
    expect(
      inspectPayload.derivedReviewExports?.every(
        (artifact) => artifact.extractability?.status === "intact",
      ),
    ).toBe(true);

    const listCapture = createBufferedCommandIo({ cwd: project.root });
    expect(
      await runListCommand(
        { bundleDir: project.bundleDir, json: true },
        listCapture.io,
      ),
    ).toBe(0);
    const listPayload = parseJsonOutput<{
      summary?: { derivedReviewExportCount?: number };
      derivedReviewExports?: Array<{
        storedPath?: string;
        status?: string;
      }>;
    }>(listCapture.stdout());
    expect(listPayload.summary?.derivedReviewExportCount).toBe(3);
    expect(listPayload.derivedReviewExports).toHaveLength(3);
    expect(
      listPayload.derivedReviewExports?.map((artifact) => artifact.storedPath),
    ).toEqual([
      "demo-docs-exports/architecture.mmd.txt",
      "demo-docs-exports/manual.mmd.txt",
      "demo-docs-exports/onboarding.mmd.txt",
    ]);
    expect(
      listPayload.derivedReviewExports?.every(
        (artifact) => artifact.status === "intact",
      ),
    ).toBe(true);
  });

  test("lists only derived docs review exports when requested", async () => {
    const project = await createProject();
    await seedAntoraDocs(project.root);
    expect(
      await runQuietBundleCommand({
        config: project.configPath,
        includeDocExports: true,
      }),
    ).toBe(0);

    const listCapture = createBufferedCommandIo({ cwd: project.root });
    expect(
      await runListCommand(
        {
          bundleDir: project.bundleDir,
          json: true,
          derivedReviewExportsOnly: true,
        },
        listCapture.io,
      ),
    ).toBe(0);
    const listPayload = parseJsonOutput<{
      summary?: { fileCount?: number; derivedReviewExportCount?: number };
      selection?: { derivedReviewExportsOnly?: boolean };
      sections?: unknown[];
      assets?: unknown[];
      files?: unknown[];
      derivedReviewExports?: Array<{ storedPath?: string }>;
    }>(listCapture.stdout());
    expect(listPayload.selection?.derivedReviewExportsOnly).toBe(true);
    expect(listPayload.summary?.fileCount).toBe(0);
    expect(listPayload.summary?.derivedReviewExportCount).toBe(3);
    expect(listPayload.sections).toEqual([]);
    expect(listPayload.assets).toEqual([]);
    expect(listPayload.files).toEqual([]);
    expect(
      listPayload.derivedReviewExports?.map((artifact) => artifact.storedPath),
    ).toEqual([
      "demo-docs-exports/architecture.mmd.txt",
      "demo-docs-exports/manual.mmd.txt",
      "demo-docs-exports/onboarding.mmd.txt",
    ]);
  });

  test("inspects only derived docs review exports when requested", async () => {
    const project = await createProject();
    await seedAntoraDocs(project.root);
    expect(
      await runQuietBundleCommand({
        config: project.configPath,
        includeDocExports: true,
      }),
    ).toBe(0);

    const inspectCapture = createBufferedCommandIo({ cwd: project.root });
    expect(
      await runInspectCommand(
        {
          config: project.configPath,
          json: true,
          derivedReviewExports: true,
        },
        inspectCapture.io,
      ),
    ).toBe(0);
    const inspectPayload = parseJsonOutput<{
      selection?: { derivedReviewExportsOnly?: boolean };
      summary?: { derivedReviewExportCount?: number };
      sections?: unknown[];
      assets?: unknown[];
      unmatchedFiles?: unknown[];
      derivedReviewExports?: Array<{ storedPath?: string }>;
      tokenBreakdown?: unknown;
    }>(inspectCapture.stdout());
    expect(inspectPayload.selection?.derivedReviewExportsOnly).toBe(true);
    expect(inspectPayload.summary?.derivedReviewExportCount).toBe(3);
    expect(inspectPayload.sections).toEqual([]);
    expect(inspectPayload.assets).toEqual([]);
    expect(inspectPayload.unmatchedFiles).toEqual([]);
    expect(inspectPayload.tokenBreakdown).toBeUndefined();
    expect(
      inspectPayload.derivedReviewExports?.map(
        (artifact) => artifact.storedPath,
      ),
    ).toEqual([
      "demo-docs-exports/architecture.mmd.txt",
      "demo-docs-exports/manual.mmd.txt",
      "demo-docs-exports/onboarding.mmd.txt",
    ]);
  });

  test("emits structured JSON for list and inspect automation", async () => {
    const { project } = await bundledProject();
    const inspectCapture = createBufferedCommandIo();
    const inspectExitCode = await runInspectCommand(
      { config: project.configPath, json: true },
      inspectCapture.io,
    );
    expect(inspectExitCode).toBe(0);
    const inspectPayload = parseJsonOutput<{
      summary?: { sectionCount?: number; assetCount?: number };
      bundleComparison?: { available?: boolean };
      sections?: Array<{
        files?: Array<{
          relativePath?: string;
          extractability?: { status?: string } | null;
        }>;
      }>;
    }>(inspectCapture.stdout());

    const listCapture = createBufferedCommandIo();
    expect(
      await runListCommand(
        { bundleDir: project.bundleDir, json: true },
        listCapture.io,
      ),
    ).toBe(0);
    const listPayload = parseJsonOutput<{
      summary?: { fileCount?: number; textFileCount?: number };
      sections?: Array<{ name: string }>;
      files?: Array<{
        path?: string;
        status?: string;
        mtime?: string;
        extractability?: { status?: string; reason?: string };
      }>;
    }>(listCapture.stdout());

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
    expect(listPayload.sections?.map((section) => section.name)).toEqual([
      "docs",
      "src",
    ]);
    expect(
      listPayload.files?.every(
        (file) =>
          file.extractability?.status === "intact" ||
          file.extractability?.status === "degraded" ||
          file.extractability?.status === "copied",
      ),
    ).toBe(true);
    expect(
      listPayload.files?.find((file) => file.path === "src/index.ts")?.status,
    ).toBe("intact");
    expect(inspectPayload.bundleComparison?.available).toBe(true);
  });

  test("includes checksum prefixes in inspect JSON for degraded files", async () => {
    const project = await createProject();
    expect(await runQuietBundleCommand({ config: project.configPath })).toBe(0);
    await tamperSectionOutput(
      project.bundleDir,
      "src",
      'export const demo = "================";\n',
      'export const demo = "tampered";\n',
    );
    const inspectCapture = createBufferedCommandIo();
    const inspectExitCode = await runInspectCommand(
      { config: project.configPath, json: true },
      inspectCapture.io,
    );
    expect(inspectExitCode).toBe(0);

    const payload = parseJsonOutput<{
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
    }>(inspectCapture.stdout());

    const degradedFile = payload.sections
      ?.flatMap((section) => section.files ?? [])
      .find((file) => file.relativePath === "src/index.ts");

    expect(degradedFile?.extractability?.status).toBe("degraded");
    expect(degradedFile?.extractability?.reason).toBe("manifest_hash_mismatch");
    expect(degradedFile?.extractability?.expectedSha256).toBeDefined();
    expect(degradedFile?.extractability?.actualSha256).toBeDefined();
  });

  test("renders human inspect output with bundle status vocabulary", async () => {
    const { project } = await bundledLinkedNotesProject();
    const inspectCapture = createBufferedCommandIo();
    const inspectExitCode = await runInspectCommand(
      { config: project.configPath, json: false },
      inspectCapture.io,
    );
    expect(inspectExitCode).toBe(0);
    const output = inspectCapture.stdout();
    expect(output).toContain("bundle_status: available");
    expect(output).toContain("workflow: static snapshot planning");
    expect(output).toContain("mcp: use cx mcp for live workspace exploration");
    expect(output).toContain("intact   src/index.ts");
    expect(output).toContain("copied   logo.png");
    expect(output).toContain(
      "[linked_note_enrichment, manifest_note_inclusion]",
    );
  });

  test("shows checksum prefixes in degraded inspect output", async () => {
    const project = await createProject();
    expect(await runQuietBundleCommand({ config: project.configPath })).toBe(0);
    await tamperSectionOutput(
      project.bundleDir,
      "src",
      'export const demo = "================";\n',
      'export const demo = "tampered";\n',
    );
    const inspectCapture = createBufferedCommandIo();
    const inspectExitCode = await runInspectCommand(
      { config: project.configPath, json: false },
      inspectCapture.io,
    );
    expect(inspectExitCode).toBe(0);
    const output = inspectCapture.stdout();
    expect(output).toContain("manifest_hash_mismatch");
    expect(output).toMatch(/expected [a-f0-9]{8}… got [a-f0-9]{8}…/);
  });

  test("renders token breakdown histogram when requested", async () => {
    const project = await createProject();
    const inspectCapture = createBufferedCommandIo();
    const inspectExitCode = await runInspectCommand(
      {
        config: project.configPath,
        json: false,
        tokenBreakdown: true,
      },
      inspectCapture.io,
    );
    expect(inspectExitCode).toBe(0);
    const output = inspectCapture.stdout();
    expect(output).toContain("Token breakdown");
    expect(output).toContain("SECTION  TOKENS   SHARE   GRAPH");
    expect(output).toContain("docs");
    expect(output).toContain("src");
    expect(output).toContain("█");
  });

  test("renders provenance rollups in bundle summary and index", async () => {
    const { project, bundleCapture } = await bundledLinkedNotesProject();
    const summary = bundleCapture.logs();
    expect(summary).toContain("Inclusion Provenance");
    expect(summary).toContain("section_match");
    expect(summary).toContain("asset_rule_match");
    expect(summary).toContain("linked_note_enrichment");
    expect(summary).toContain("manifest_note_inclusion");

    const bundleIndex = await fs.readFile(
      path.join(project.bundleDir, "demo-handover.xml.txt"),
      "utf8",
    );
    expect(bundleIndex).toContain("<inclusion_provenance>");
    expect(bundleIndex).toContain("section_match:");
    expect(bundleIndex).toContain("asset_rule_match:");
    expect(bundleIndex).toContain("linked_note_enrichment:");
    expect(bundleIndex).toContain("manifest_note_inclusion:");
  });

  test("surfaces provenance suffixes in human list output", async () => {
    const { project } = await bundledLinkedNotesProject();

    const listCapture = createBufferedCommandIo();
    expect(
      await runListCommand(
        { bundleDir: project.bundleDir, json: false },
        listCapture.io,
      ),
    ).toBe(0);

    const output = listCapture.stdout();
    expect(output).toMatch(/README\.md\s+\[section_match\]/);
    expect(output).toMatch(
      /notes\/linked-note\.md\s+\[linked_note_enrichment, manifest_note_inclusion\]/,
    );
    expect(output).toMatch(/logo\.png\s+\[asset_rule_match\]/);
  });

  // verify-against-integration: Exercises CLI JSON contract plus real --against selection wiring through config loading and source-tree normalization.
  test("emits structured JSON for bundle and verify automation", async () => {
    const project = await createProject();
    const bundleCapture = createBufferedCommandIo();
    expect(
      await runBundleCommand(
        { config: project.configPath, json: true },
        bundleCapture.io,
      ),
    ).toBe(0);
    const bundlePayload = parseJsonOutput<{
      checksumFile?: string;
    }>(bundleCapture.stdout());

    const verifyCapture = createBufferedCommandIo();
    const verifyExitCode = await runVerifyCommand(
      {
        bundleDir: project.bundleDir,
        againstDir: project.root,
        files: ["src/index.ts"],
        json: true,
        sections: undefined,
      },
      verifyCapture.io,
    );
    expect(verifyExitCode).toBe(0);

    const verifyPayload = parseJsonOutput<{
      valid?: boolean;
      files?: string[];
      derivedReviewExports?: {
        totalCount?: number;
        intactCount?: number;
        blockedCount?: number;
      } | null;
    }>(verifyCapture.stdout());

    expect(bundlePayload.checksumFile).toBe("demo.sha256");
    expect(verifyPayload.valid).toBe(true);
    expect(verifyPayload.files).toEqual(["src/index.ts"]);
    expect(verifyPayload.derivedReviewExports).toEqual({
      totalCount: 0,
      intactCount: 0,
      blockedCount: 0,
      files: [],
    });
  });

  test("summarizes derived docs review exports in verify JSON", async () => {
    const project = await createProject();
    await seedAntoraDocs(project.root);
    expect(
      await runQuietBundleCommand({
        config: project.configPath,
        includeDocExports: true,
      }),
    ).toBe(0);

    const verifyCapture = createBufferedCommandIo();
    const verifyExitCode = await runVerifyCommand(
      { bundleDir: project.bundleDir, json: true },
      verifyCapture.io,
    );
    expect(verifyExitCode).toBe(0);

    const payload = parseJsonOutput<{
      valid?: boolean;
      derivedReviewExports?: {
        totalCount?: number;
        intactCount?: number;
        blockedCount?: number;
        files?: Array<{
          storedPath?: string;
          status?: string;
          reason?: string;
        }>;
      } | null;
    }>(verifyCapture.stdout());

    expect(payload.valid).toBe(true);
    expect(payload.derivedReviewExports?.totalCount).toBe(3);
    expect(payload.derivedReviewExports?.intactCount).toBe(3);
    expect(payload.derivedReviewExports?.blockedCount).toBe(0);
    expect(
      payload.derivedReviewExports?.files?.every(
        (artifact) =>
          artifact.status === "intact" && artifact.reason === "intact",
      ),
    ).toBe(true);
  });

  test("emits structured JSON failure payload for checksum omission", async () => {
    const project = await createProject();

    expect(await runQuietBundleCommand({ config: project.configPath })).toBe(0);
    const checksumPath = path.join(project.bundleDir, "demo.sha256");
    await fs.writeFile(
      checksumPath,
      (await fs.readFile(checksumPath, "utf8"))
        .split("\n")
        .filter((line) => !line.includes("demo-manifest.json"))
        .join("\n"),
      "utf8",
    );

    const verifyCapture = createBufferedCommandIo();
    const verifyExitCode = await runVerifyCommand(
      { bundleDir: project.bundleDir, json: true },
      verifyCapture.io,
    );
    expect(verifyExitCode).toBe(10);

    const payload = parseJsonOutput<{
      valid?: boolean;
      error?: {
        type?: string;
        message?: string;
        path?: string;
        remediation?: {
          recommendedCommand?: string;
          docsRef?: string;
          nextSteps?: string[];
        } | null;
      };
    }>(verifyCapture.stdout());

    expect(payload.valid).toBe(false);
    expect(payload.error?.type).toBe("checksum_omission");
    expect(payload.error?.path).toBe("demo-manifest.json");
    expect(payload.error?.message).toContain(
      "Checksum file is missing an entry for demo-manifest.json.",
    );
    expect(payload.error?.remediation?.recommendedCommand).toBe(
      "cx validate dist/demo-bundle",
    );
  });

  // verify-against-integration: Requires a real on-disk source drift mutation and verifies operator-facing JSON remediation payloads from the command boundary.
  test("emits structured JSON failure payload for source-tree drift", async () => {
    const project = await driftedBundledProject();

    const verifyCapture = createBufferedCommandIo();
    const verifyExitCode = await runVerifyCommand(
      {
        bundleDir: project.bundleDir,
        againstDir: project.root,
        json: true,
      },
      verifyCapture.io,
    );
    expect(verifyExitCode).toBe(10);

    const payload = parseJsonOutput<{
      valid?: boolean;
      error?: {
        type?: string;
        message?: string;
        path?: string;
        remediation?: {
          recommendedCommand?: string;
          docsRef?: string;
          nextSteps?: string[];
        } | null;
      };
    }>(verifyCapture.stdout());

    expect(payload.valid).toBe(false);
    expect(payload.error?.type).toBe("source_tree_drift");
    expect(payload.error?.path).toBe("README.md");
    expect(payload.error?.message).toContain(
      "Source tree mismatch for README.md",
    );
    expect(payload.error?.remediation?.recommendedCommand).toBe(
      "cx bundle --config cx.toml",
    );
  });

  test("emits detailed JSON for validate automation", async () => {
    const { project } = await bundledProject();
    const validateCapture = createBufferedCommandIo();
    expect(
      await runValidateCommand(
        { bundleDir: project.bundleDir, json: true },
        validateCapture.io,
      ),
    ).toBe(0);

    const payload = parseJsonOutput<{
      valid?: boolean;
      checksumFile?: string;
      schemaVersion?: number;
      bundleVersion?: number;
      summary?: {
        manifestName?: string;
        sectionCount?: number;
        fileCount?: number;
      };
    }>(validateCapture.stdout());

    expect(payload.valid).toBe(true);
    expect(payload.checksumFile).toBe("demo.sha256");
    expect(payload.schemaVersion).toBe(MANIFEST_SCHEMA_VERSION);
    expect(payload.bundleVersion).toBe(1);
    expect(payload.summary?.manifestName).toBe("demo-manifest.json");
    expect(payload.summary?.sectionCount).toBe(2);
    expect(payload.summary?.fileCount).toBe(4);
  });

  // verify-against-integration: Keeps one end-to-end smoke path for real bundle artifacts, Repomix rendering, and source-tree verification.
  test("verifies a bundle against the original source tree", async () => {
    const { project } = await bundledProject();
    expect(
      await runQuietVerifyCommand({
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
    expect(await runQuietBundleCommand({ config: project.configPath })).toBe(0);

    const preservedSectionPath = path.join(
      project.bundleDir,
      "demo-src.xml.txt",
    );
    const preservedBefore = await sha256File(preservedSectionPath);
    const orphanedAssetPath = path.join(
      project.bundleDir,
      "assets",
      "logo.png",
    );
    expect(await fs.stat(orphanedAssetPath)).toBeDefined();

    await fs.writeFile(
      project.configPath,
      (await fs.readFile(project.configPath, "utf8")).replace(
        'include = ["**/*.png"]',
        "include = []",
      ),
      "utf8",
    );

    expect(
      await runQuietBundleCommand({ config: project.configPath, update: true }),
    ).toBe(0);

    await expect(fs.stat(orphanedAssetPath)).rejects.toThrow();
    const preservedAfter = await sha256File(preservedSectionPath);
    expect(preservedAfter).toBe(preservedBefore);
  });

  test("--update prunes orphaned derived docs review exports", async () => {
    const project = await createProject();
    await seedAntoraDocs(project.root);
    expect(
      await runQuietBundleCommand({
        config: project.configPath,
        includeDocExports: true,
      }),
    ).toBe(0);

    const orphanedExportPath = path.join(
      project.bundleDir,
      "demo-docs-exports",
      "obsolete.mmd.txt",
    );
    await fs.writeFile(orphanedExportPath, "# obsolete\n", "utf8");
    expect(await fs.stat(orphanedExportPath)).toBeDefined();

    expect(
      await runQuietBundleCommand({
        config: project.configPath,
        includeDocExports: true,
        update: true,
      }),
    ).toBe(0);

    await expect(fs.stat(orphanedExportPath)).rejects.toThrow();
  });

  test("--update refuses to prune non-bundle directories", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "cx-update-safety-"));
    await fs.mkdir(path.join(root, "src"), { recursive: true });
    await fs.writeFile(
      path.join(root, "src", "index.ts"),
      "export const x = 1;\n",
      "utf8",
    );
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

    await expect(
      runQuietBundleCommand({ config: configPath, update: true }),
    ).rejects.toThrow("Refusing --update prune");
    expect(await fs.readFile(path.join(root, "README.md"), "utf8")).toBe(
      "# keep\n",
    );
  });

  // verify-against-integration: Confirms human-mode command failures surface real source-tree drift when filesystem content changes post-bundle.
  test("fails verify --against when the source tree drifts", async () => {
    const project = await driftedBundledProject();

    await expect(
      runQuietVerifyCommand({
        bundleDir: project.bundleDir,
        againstDir: project.root,
        files: undefined,
        json: false,
        sections: undefined,
      }),
    ).rejects.toThrow("Source tree mismatch");
  });

  // verify-against-integration: Validates real CLI file-filter semantics against the workspace boundary where one path drifts and another remains valid.
  test("supports selective verify --against by file", async () => {
    const project = await driftedBundledProject();

    expect(
      await runQuietVerifyCommand({
        bundleDir: project.bundleDir,
        againstDir: project.root,
        files: ["src/index.ts"],
        json: false,
        sections: undefined,
      }),
    ).toBe(0);

    await expect(
      runQuietVerifyCommand({
        bundleDir: project.bundleDir,
        againstDir: project.root,
        files: ["README.md"],
        json: false,
        sections: undefined,
      }),
    ).rejects.toThrow("Source tree mismatch");
  });

  // verify-against-integration: Validates real section-filter semantics across bundle metadata, source-tree mutation, and command-level selection behavior.
  test("supports selective verify --against by section", async () => {
    const project = await driftedBundledProject();

    expect(
      await runQuietVerifyCommand({
        bundleDir: project.bundleDir,
        againstDir: project.root,
        files: undefined,
        json: false,
        sections: ["src"],
      }),
    ).toBe(0);

    await expect(
      runQuietVerifyCommand({
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

    expect(await runQuietBundleCommand({ config: project.configPath })).toBe(0);
    await fs.writeFile(
      checksumPath,
      (await fs.readFile(checksumPath, "utf8"))
        .split("\n")
        .filter((line) => !line.includes("demo-manifest.json"))
        .join("\n"),
      "utf8",
    );

    await expect(
      runQuietVerifyCommand({ bundleDir: project.bundleDir, json: false }),
    ).rejects.toThrow(
      "Checksum file is missing an entry for demo-manifest.json.",
    );
  });

  test("rejects bundles with multiple manifest files", async () => {
    const project = await createProject();

    expect(await runQuietBundleCommand({ config: project.configPath })).toBe(0);
    await fs.copyFile(
      path.join(project.bundleDir, "demo-manifest.json"),
      path.join(project.bundleDir, "demo-copy-manifest.json"),
    );

    await expect(loadManifestFromBundle(project.bundleDir)).rejects.toThrow(
      "Bundle must contain exactly one manifest file, found 2.",
    );
  });
});
