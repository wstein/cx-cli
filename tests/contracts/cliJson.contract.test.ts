// test-lane: contract

import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { afterEach, describe, expect, test } from "vitest";
import { main } from "../../src/cli/main.js";
import { captureCli } from "../helpers/cli/captureCli.js";
import { createBufferedCommandIo } from "../helpers/cli/createBufferedCommandIo.js";
import { parseJsonOutput } from "../helpers/cli/parseJsonOutput.js";
import { buildConfig } from "../helpers/config/buildConfig.js";
import { createWorkspace } from "../helpers/workspace/createWorkspace.js";

const workspaceRoots: string[] = [];
const execFileAsync = promisify(execFile);

afterEach(async () => {
  await Promise.all(
    workspaceRoots
      .splice(0)
      .map((root) => fs.rm(root, { recursive: true, force: true })),
  );
});

async function createProject(options?: {
  includeLinkedNotes?: boolean;
  initializeGit?: boolean;
}): Promise<{ root: string; configPath: string }> {
  const workspace = await createWorkspace({
    config: buildConfig({
      manifest: {
        includeLinkedNotes: options?.includeLinkedNotes ?? false,
      },
    }),
    files: {
      "src/index.ts": "export const ok = 1;\n",
      "logo.png": "fake-png",
      ...(options?.includeLinkedNotes
        ? {
            "notes/linked-note.md": `---
id: 20260418120000
aliases: []
tags: []
---

This linked note stays visible through inspect provenance for governance-safe coverage.

## Links

`,
          }
        : {}),
    },
  });

  if (options?.initializeGit === true) {
    await execFileAsync("git", ["init", "-q"], { cwd: workspace.rootDir });
    await execFileAsync("git", ["config", "user.email", "cx@example.com"], {
      cwd: workspace.rootDir,
    });
    await execFileAsync("git", ["config", "user.name", "cx"], {
      cwd: workspace.rootDir,
    });
    await execFileAsync("git", ["add", "."], { cwd: workspace.rootDir });
    await execFileAsync("git", ["commit", "-q", "-m", "init"], {
      cwd: workspace.rootDir,
    });
  }

  workspaceRoots.push(workspace.rootDir);
  return {
    root: workspace.rootDir,
    configPath: workspace.configPath,
  };
}

describe("CLI JSON contract", () => {
  test("docs export --json returns structured export metadata", async () => {
    const outputDir = await fs.mkdtemp(
      path.join(process.cwd(), "tmp-docs-json-"),
    );
    workspaceRoots.push(outputDir);

    const result = await captureCli({
      run: () => main(["docs", "export", "--output-dir", outputDir, "--json"]),
    });
    expect(result.exitCode).toBe(0);

    const payload = parseJsonOutput<{
      command?: string;
      valid?: boolean;
      playbookPath?: string;
      rootLevel?: number;
      exportCount?: number;
      totalPages?: number;
      totalDiagnostics?: number;
      exports?: Array<{
        assemblyName?: string;
        moduleName?: string | null;
        rootLevel?: number;
        outputFile?: string;
        pageCount?: number;
        diagnostics?: { status?: string; diagnostics?: unknown[] };
      }>;
    }>(result.stdout);
    expect(payload.command).toBe("docs export");
    expect(payload.valid).toBe(true);
    expect(payload.playbookPath).toBe(
      path.join(process.cwd(), "antora-playbook.yml"),
    );
    expect(payload.rootLevel).toBe(1);
    expect(payload.exportCount).toBeGreaterThan(0);
    expect(payload.totalPages).toBeGreaterThan(0);
    expect(payload.totalDiagnostics).toBe(0);
    expect(payload.exports?.length).toBe(payload.exportCount);
    expect(
      payload.exports?.every(
        (artifact) =>
          typeof artifact.assemblyName === "string" &&
          artifact.assemblyName.length > 0 &&
          artifact.outputFile?.endsWith(".mmd") === true &&
          artifact.rootLevel === 1,
      ),
    ).toBe(true);
    for (const artifact of payload.exports ?? []) {
      expect(artifact.pageCount).toBeGreaterThan(0);
      expect(artifact.diagnostics?.status).toBe("clean");
      expect(artifact.diagnostics?.diagnostics).toEqual([]);
    }
  }, 30_000);

  test("inspect --json returns structured payload", async () => {
    const project = await createProject();
    const result = await captureCli({
      run: () => main(["inspect", "--config", project.configPath, "--json"]),
    });
    expect(result.exitCode).toBe(0);
    const payload = parseJsonOutput<{
      summary?: { sectionCount?: number; textFileCount?: number };
      sections?: Array<{ name?: string }>;
    }>(result.stdout);
    expect(payload.summary?.sectionCount).toBeGreaterThan(0);
    expect(payload.summary?.textFileCount).toBeGreaterThan(0);
    expect(Array.isArray(payload.sections)).toBe(true);
  }, 30_000);

  test("inspect --json exposes asset provenance markers", async () => {
    const project = await createProject();
    const result = await captureCli({
      run: () => main(["inspect", "--config", project.configPath, "--json"]),
    });
    expect(result.exitCode).toBe(0);

    const payload = parseJsonOutput<{
      assets?: Array<{
        relativePath?: string;
        provenance?: string[];
      }>;
    }>(result.stdout);
    const asset = payload.assets?.find(
      (entry) => entry.relativePath === "logo.png",
    );

    expect(asset?.provenance).toEqual(["asset_rule_match"]);
  });

  test("inspect --json exposes linked-note provenance markers", async () => {
    const project = await createProject({ includeLinkedNotes: true });
    const notePath = path.join(project.root, "notes", "seed.md");
    await fs.writeFile(
      notePath,
      `---
id: 20260418115900
aliases: []
tags: []
---

This seed note links to another durable note for inspect provenance coverage.

See [[20260418120000]].

## Links

`,
      "utf8",
    );

    const result = await captureCli({
      run: () => main(["inspect", "--config", project.configPath, "--json"]),
    });
    expect(result.exitCode).toBe(0);

    const payload = parseJsonOutput<{
      sections?: Array<{
        name?: string;
        files?: Array<{
          relativePath?: string;
          provenance?: string[];
        }>;
      }>;
    }>(result.stdout);
    const docs = payload.sections?.find((section) => section.name === "docs");
    const linkedNote = docs?.files?.find(
      (file) => file.relativePath === "notes/linked-note.md",
    );

    expect(linkedNote?.provenance).toEqual([
      "linked_note_enrichment",
      "manifest_note_inclusion",
    ]);
  });

  test("doctor workflow --json returns required fields", async () => {
    const result = await captureCli({
      run: () =>
        main([
          "doctor",
          "workflow",
          "--json",
          "--task",
          "inspect a plan then update notes",
        ]),
    });
    expect(result.exitCode).toBe(0);

    const payload = parseJsonOutput<{
      mode?: string;
      sequence?: string[];
      reason?: string;
      signals?: string[];
    }>(result.stdout);
    expect(typeof payload.mode).toBe("string");
    expect(Array.isArray(payload.sequence)).toBe(true);
    expect(typeof payload.reason).toBe("string");
    expect(Array.isArray(payload.signals)).toBe(true);
  });

  test("mcp catalog --json returns the machine-readable tool catalog", async () => {
    const result = await captureCli({
      run: () => main(["mcp", "catalog", "--json"]),
    });
    expect(result.exitCode).toBe(0);

    const payload = parseJsonOutput<{
      command?: string;
      toolCatalogVersion?: number;
      toolCatalog?: Array<{
        name: string;
        capability: string;
        stability: string;
      }>;
      toolCatalogSummary?: {
        totalTools?: number;
      };
    }>(result.stdout);
    expect(payload.command).toBe("mcp catalog");
    expect(payload.toolCatalogVersion).toBe(1);
    expect(payload.toolCatalogSummary?.totalTools).toBeGreaterThan(0);
    expect(payload.toolCatalog).toContainEqual({
      name: "bundle",
      capability: "plan",
      stability: "STABLE",
    });
  });

  test("list --json returns selection metadata", async () => {
    const project = await createProject();
    const cwd = process.cwd();
    process.chdir(project.root);
    await expect(
      main(["bundle", "--config", project.configPath]),
    ).resolves.toBe(0);
    let result: Awaited<ReturnType<typeof captureCli>>;
    try {
      result = await captureCli({
        run: () =>
          main([
            "list",
            "dist/demo-bundle",
            "--json",
            "--section",
            "src",
            "--file",
            "src/index.ts",
          ]),
      });
    } finally {
      process.chdir(cwd);
    }
    expect(result.exitCode).toBe(0);

    const payload = parseJsonOutput<{
      selection?: {
        sections?: string[];
        files?: string[];
        derivedReviewExportsOnly?: boolean;
      };
      summary?: { fileCount?: number };
    }>(result.stdout);
    expect(payload.selection?.sections).toEqual(["src"]);
    expect(payload.selection?.files).toEqual(["src/index.ts"]);
    expect(payload.selection?.derivedReviewExportsOnly).toBe(false);
    expect(payload.summary?.fileCount).toBe(1);
  });

  test("inspect and list --json surface derived review exports after opt-in bundling", async () => {
    const project = await createProject({ initializeGit: true });
    await fs.mkdir(path.join(project.root, "docs"), { recursive: true });
    await fs.cp(
      path.join(process.cwd(), "docs", "modules"),
      path.join(project.root, "docs", "modules"),
      { recursive: true },
    );
    await fs.copyFile(
      path.join(process.cwd(), "docs", "antora.yml"),
      path.join(project.root, "docs", "antora.yml"),
    );
    await fs.copyFile(
      path.join(process.cwd(), "antora-playbook.yml"),
      path.join(project.root, "antora-playbook.yml"),
    );

    const cwd = process.cwd();
    process.chdir(project.root);
    try {
      await expect(
        main([
          "bundle",
          "--config",
          project.configPath,
          "--include-doc-exports",
        ]),
      ).resolves.toBe(0);

      const inspectResult = await captureCli({
        run: () => main(["inspect", "--config", project.configPath, "--json"]),
      });
      expect(inspectResult.exitCode).toBe(0);
      const inspectPayload = parseJsonOutput<{
        selection?: { derivedReviewExportsOnly?: boolean };
        summary?: { derivedReviewExportCount?: number };
        derivedReviewExports?: Array<{ storedPath?: string }>;
      }>(inspectResult.stdout);
      expect(inspectPayload.selection?.derivedReviewExportsOnly).toBe(false);
      expect(inspectPayload.summary?.derivedReviewExportCount).toBeGreaterThan(
        0,
      );
      expect(inspectPayload.derivedReviewExports?.length).toBe(
        inspectPayload.summary?.derivedReviewExportCount,
      );

      const inspectDerivedOnlyResult = await captureCli({
        run: () =>
          main([
            "inspect",
            "--config",
            project.configPath,
            "--json",
            "--derived-review-exports",
          ]),
      });
      expect(inspectDerivedOnlyResult.exitCode).toBe(0);
      const inspectDerivedOnlyPayload = parseJsonOutput<{
        selection?: { derivedReviewExportsOnly?: boolean };
        sections?: unknown[];
        assets?: unknown[];
        unmatchedFiles?: unknown[];
        derivedReviewExports?: Array<{ storedPath?: string }>;
      }>(inspectDerivedOnlyResult.stdout);
      expect(
        inspectDerivedOnlyPayload.selection?.derivedReviewExportsOnly,
      ).toBe(true);
      expect(inspectDerivedOnlyPayload.sections).toEqual([]);
      expect(inspectDerivedOnlyPayload.assets).toEqual([]);
      expect(inspectDerivedOnlyPayload.unmatchedFiles).toEqual([]);
      expect(
        inspectDerivedOnlyPayload.derivedReviewExports?.length,
      ).toBeGreaterThan(0);

      const listResult = await captureCli({
        run: () => main(["list", "dist/demo-bundle", "--json"]),
      });
      expect(listResult.exitCode).toBe(0);
      const listPayload = parseJsonOutput<{
        summary?: { derivedReviewExportCount?: number };
        derivedReviewExports?: Array<{ storedPath?: string }>;
      }>(listResult.stdout);
      expect(listPayload.summary?.derivedReviewExportCount).toBeGreaterThan(0);
      expect(listPayload.derivedReviewExports?.length).toBe(
        listPayload.summary?.derivedReviewExportCount,
      );

      const derivedOnlyResult = await captureCli({
        run: () =>
          main([
            "list",
            "dist/demo-bundle",
            "--json",
            "--derived-review-exports-only",
          ]),
      });
      expect(derivedOnlyResult.exitCode).toBe(0);
      const derivedOnlyPayload = parseJsonOutput<{
        selection?: { derivedReviewExportsOnly?: boolean };
        summary?: { fileCount?: number; derivedReviewExportCount?: number };
        files?: unknown[];
        sections?: unknown[];
        assets?: unknown[];
        derivedReviewExports?: Array<{ storedPath?: string }>;
      }>(derivedOnlyResult.stdout);
      expect(derivedOnlyPayload.selection?.derivedReviewExportsOnly).toBe(true);
      expect(derivedOnlyPayload.summary?.fileCount).toBe(0);
      expect(
        derivedOnlyPayload.summary?.derivedReviewExportCount,
      ).toBeGreaterThan(0);
      expect(derivedOnlyPayload.files).toEqual([]);
      expect(derivedOnlyPayload.sections).toEqual([]);
      expect(derivedOnlyPayload.assets).toEqual([]);
      expect(derivedOnlyPayload.derivedReviewExports?.length).toBe(
        derivedOnlyPayload.summary?.derivedReviewExportCount,
      );

      const verifyCapture = createBufferedCommandIo({ cwd: project.root });
      const verifyExitCode = await main(
        ["verify", "dist/demo-bundle", "--json"],
        verifyCapture.io,
      );
      const verifyResult = {
        exitCode: verifyExitCode,
        stdout: verifyCapture.stdout(),
        stderr: verifyCapture.stderr(),
      };
      expect(verifyResult.exitCode).toBe(0);
      const verifyPayload = parseJsonOutput<{
        derivedReviewExports?: {
          totalCount?: number;
          intactCount?: number;
          blockedCount?: number;
          cleanCount?: number;
          flaggedCount?: number;
          totalDiagnosticCount?: number;
        } | null;
      }>(verifyResult.stdout);
      expect(verifyPayload.derivedReviewExports?.totalCount).toBeGreaterThan(0);
      expect(verifyPayload.derivedReviewExports?.intactCount).toBe(
        verifyPayload.derivedReviewExports?.totalCount,
      );
      expect(verifyPayload.derivedReviewExports?.blockedCount).toBe(0);
      expect(verifyPayload.derivedReviewExports?.cleanCount).toBe(
        verifyPayload.derivedReviewExports?.totalCount,
      );
      expect(verifyPayload.derivedReviewExports?.flaggedCount).toBe(0);
      expect(verifyPayload.derivedReviewExports?.totalDiagnosticCount).toBe(0);
    } finally {
      process.chdir(cwd);
    }
  }, 30_000);
});
