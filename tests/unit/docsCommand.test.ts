// test-lane: unit

import fs from "node:fs/promises";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { runDocsCommand } from "../../src/cli/commands/docs.js";
import { createProject, seedAntoraDocs } from "../bundle/helpers.js";
import { createBufferedCommandIo } from "../helpers/cli/createBufferedCommandIo.js";
import { parseJsonOutput } from "../helpers/cli/parseJsonOutput.js";
import { buildConfig } from "../helpers/config/buildConfig.js";
import { createWorkspace } from "../helpers/workspace/createWorkspace.js";

const workspaceRoots: string[] = [];

afterEach(async () => {
  await Promise.all(
    workspaceRoots
      .splice(0)
      .map((root) => fs.rm(root, { recursive: true, force: true })),
  );
});

describe("runDocsCommand", () => {
  test("compiles generated architecture docs from notes", async () => {
    const workspace = await createWorkspace();
    workspaceRoots.push(workspace.rootDir);
    await fs.mkdir(path.join(workspace.rootDir, "notes"), { recursive: true });
    await fs.writeFile(
      path.join(workspace.rootDir, "notes", "Render Kernel Constitution.md"),
      `---
id: 20260421141000
title: Render Kernel Constitution
target: current
tags: [architecture, kernel, contract]
---

The render kernel owns the production proof path so architecture docs can be generated from durable notes.
`,
      "utf8",
    );

    const capture = createBufferedCommandIo({ cwd: workspace.rootDir });
    expect(
      await runDocsCommand(
        {
          subcommand: "compile",
          config: workspace.configPath,
          profile: "architecture",
          json: true,
        },
        capture.io,
      ),
    ).toBe(0);

    const payload = parseJsonOutput<{
      command: string;
      profile: string;
      outputPath: string;
      sourceNoteIds: string[];
    }>(capture.stdout());
    expect(payload.command).toBe("docs compile");
    expect(payload.profile).toBe("architecture");
    expect(payload.sourceNoteIds).toEqual(["20260421141000"]);
    await expect(fs.readFile(payload.outputPath, "utf8")).resolves.toContain(
      "cx-docs-generated:start profile=architecture",
    );
  });

  test("detects stale generated docs drift", async () => {
    const workspace = await createWorkspace();
    workspaceRoots.push(workspace.rootDir);
    await fs.mkdir(path.join(workspace.rootDir, "notes"), { recursive: true });
    await fs.writeFile(
      path.join(workspace.rootDir, "notes", "Render Kernel Constitution.md"),
      `---
id: 20260421141001
title: Render Kernel Constitution
target: current
tags: [architecture, kernel, contract]
---

The render kernel owns the production proof path so drift checks can compare generated documentation.
`,
      "utf8",
    );

    const compileCapture = createBufferedCommandIo({ cwd: workspace.rootDir });
    expect(
      await runDocsCommand(
        {
          subcommand: "compile",
          config: workspace.configPath,
          profile: "architecture",
          json: true,
        },
        compileCapture.io,
      ),
    ).toBe(0);

    const compiled = parseJsonOutput<{ outputPath: string }>(
      compileCapture.stdout(),
    );
    await fs.appendFile(compiled.outputPath, "\nManual stale edit.\n");

    const driftCapture = createBufferedCommandIo({ cwd: workspace.rootDir });
    expect(
      await runDocsCommand(
        {
          subcommand: "drift",
          config: workspace.configPath,
          profile: "architecture",
          json: true,
        },
        driftCapture.io,
      ),
    ).toBe(1);

    const drift = parseJsonOutput<{
      valid: boolean;
      staleGeneratedDocs: Array<{ reason: string }>;
    }>(driftCapture.stdout());
    expect(drift.valid).toBe(false);
    expect(drift.staleGeneratedDocs).toEqual([
      expect.objectContaining({ reason: "stale" }),
    ]);
  });

  test("defaults to dist/<docs.target_dir> when output-dir is not provided", async () => {
    const workspace = await createWorkspace({
      config: buildConfig({
        sourceRoot: process.cwd(),
        docs: { targetDir: "review-docs", rootLevel: 1 },
      }),
    });
    workspaceRoots.push(workspace.rootDir);

    const capture = createBufferedCommandIo({ cwd: workspace.rootDir });
    expect(
      await runDocsCommand(
        {
          subcommand: "export",
          config: workspace.configPath,
          json: true,
        },
        capture.io,
      ),
    ).toBe(0);

    const payload = parseJsonOutput<{
      valid?: boolean;
      outputDir?: string;
      playbookPath?: string;
      rootLevel?: number;
      totalDiagnostics?: number;
      exports?: Array<{
        assemblyName?: string;
        diagnostics?: { status?: string; diagnostics?: unknown[] };
      }>;
    }>(capture.stdout());
    expect(payload.valid).toBe(true);
    expect(payload.outputDir).toBe(
      path.join(workspace.rootDir, "dist", "review-docs"),
    );
    expect(payload.playbookPath).toBe(
      path.join(process.cwd(), "antora-playbook.yml"),
    );
    expect(payload.rootLevel).toBe(1);
    expect(payload.totalDiagnostics).toBe(0);
    expect(payload.exports?.map((artifact) => artifact.assemblyName)).toEqual([
      "architecture",
      "docs-index",
      "manual",
      "start-here",
    ]);
    expect(
      payload.exports?.every(
        (artifact) =>
          artifact.diagnostics?.status === "clean" &&
          artifact.diagnostics.diagnostics?.length === 0,
      ),
    ).toBe(true);
    expect(capture.stderr()).toBe("");
  }, 30_000);

  test("honors root-level overrides in structured JSON output", async () => {
    const project = await createProject({ initializeGit: true });
    workspaceRoots.push(project.root);
    await seedAntoraDocs(project.root);

    const capture = createBufferedCommandIo({ cwd: project.root });
    expect(
      await runDocsCommand(
        {
          subcommand: "export",
          config: project.configPath,
          rootLevel: 0,
          json: true,
        },
        capture.io,
      ),
    ).toBe(0);

    const payload = parseJsonOutput<{
      valid?: boolean;
      rootLevel?: number;
      exports?: Array<{
        assemblyName?: string;
        moduleName?: string | null;
      }>;
    }>(capture.stdout());

    expect(payload.valid).toBe(true);
    expect(payload.rootLevel).toBe(0);
    expect(payload.exports).toHaveLength(1);
    expect(payload.exports?.[0]).toEqual(
      expect.objectContaining({
        assemblyName: "index",
        moduleName: null,
      }),
    );
  }, 30_000);
});
