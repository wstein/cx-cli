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
