// test-lane: unit

import fs from "node:fs/promises";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { runDocsCommand } from "../../src/cli/commands/docs.js";
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

    const payload = parseJsonOutput<{ outputDir?: string }>(capture.stdout());
    expect(payload.outputDir).toBe(
      path.join(workspace.rootDir, "dist", "review-docs"),
    );
  });
});
