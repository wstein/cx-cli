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
        docs: { targetDir: "review-docs" },
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
      totalDiagnostics?: number;
      exports?: Array<{
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
    expect(payload.totalDiagnostics).toBe(0);
    expect(
      payload.exports?.every(
        (artifact) =>
          artifact.diagnostics?.status === "clean" &&
          artifact.diagnostics.diagnostics?.length === 0,
      ),
    ).toBe(true);
    expect(capture.stderr()).toBe("");
  });

  test("emits structured JSON diagnostics when validation fails", async () => {
    const project = await createProject();
    workspaceRoots.push(project.root);
    await seedAntoraDocs(project.root);

    const onboardingIndexPath = path.join(
      project.root,
      "docs/modules/onboarding/pages/index.adoc",
    );
    await fs.appendFile(
      onboardingIndexPath,
      "\nSee [broken](manual:operator-manual.html).\n",
      "utf8",
    );

    const capture = createBufferedCommandIo({ cwd: project.root });
    expect(
      await runDocsCommand(
        {
          subcommand: "export",
          config: project.configPath,
          json: true,
        },
        capture.io,
      ),
    ).toBe(12);

    const payload = parseJsonOutput<{
      valid?: boolean;
      error?: {
        type?: string;
        surfaceName?: string;
        diagnostics?: {
          status?: string;
          diagnostics?: Array<{ code?: string; destination?: string }>;
        };
      };
    }>(capture.stdout());

    expect(payload.valid).toBe(false);
    expect(payload.error?.type).toBe("validation");
    expect(payload.error?.surfaceName).toBe("onboarding");
    expect(payload.error?.diagnostics?.status).toBe("flagged");
    expect(payload.error?.diagnostics?.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "module_qualified_html",
          destination: "manual:operator-manual.html",
        }),
      ]),
    );
  });
});
