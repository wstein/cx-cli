// test-lane: unit
import { afterEach, describe, expect, test } from "bun:test";
import fs from "node:fs/promises";
import path from "node:path";

import { runBundleCommand } from "../../src/cli/commands/bundle.js";
import { collectInspectReport } from "../../src/inspect/report.js";
import { createProject } from "../bundle/helpers.js";
import { createBufferedCommandIo } from "../helpers/cli/createBufferedCommandIo.js";

describe("collectInspectReport", () => {
  const roots: string[] = [];

  afterEach(async () => {
    await Promise.all(
      roots
        .splice(0)
        .map((root) => fs.rm(root, { recursive: true, force: true })),
    );
  });

  test("reports when no comparable bundle exists yet", async () => {
    const project = await createProject();
    roots.push(project.root);
    const { loadCxConfig } = await import("../../src/config/load.js");

    const report = await collectInspectReport({
      config: await loadCxConfig(project.configPath),
    });

    expect(report.bundleComparison.available).toBe(false);
    expect(report.bundleComparison.bundleDir).toBe(project.bundleDir);
    expect(report.summary.textFileCount).toBeGreaterThan(0);
  });

  test("reports token and extractability details for an existing bundle", async () => {
    const project = await createProject();
    roots.push(project.root);

    const io = createBufferedCommandIo({ cwd: project.root });
    await expect(
      runBundleCommand({ config: project.configPath }, io.io),
    ).resolves.toBe(0);

    const { loadCxConfig } = await import("../../src/config/load.js");
    const report = await collectInspectReport({
      config: await loadCxConfig(project.configPath),
      tokenBreakdown: true,
    });

    expect(report.bundleComparison).toMatchObject({
      available: true,
      bundleDir: project.bundleDir,
      manifestName: "demo-manifest.json",
    });
    expect(report.tokenBreakdown?.totalTokenCount).toBeGreaterThan(0);
    expect(report.tokenBreakdown?.sections.length).toBeGreaterThan(0);
    expect(report.sections[0]?.files[0]?.extractability?.status).toBe("intact");
  });

  test("marks the bundle as unavailable when the manifest no longer matches the current plan", async () => {
    const project = await createProject();
    roots.push(project.root);

    const io = createBufferedCommandIo({ cwd: project.root });
    await expect(
      runBundleCommand({ config: project.configPath }, io.io),
    ).resolves.toBe(0);

    const manifestPath = path.join(project.bundleDir, "demo-manifest.json");
    const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8")) as {
      projectName: string;
    };
    manifest.projectName = "different-project";
    await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

    const { loadCxConfig } = await import("../../src/config/load.js");
    const report = await collectInspectReport({
      config: await loadCxConfig(project.configPath),
    });

    expect(report.bundleComparison).toEqual({
      available: false,
      bundleDir: project.bundleDir,
      reason: "Existing bundle does not match the current plan.",
    });
  });
});
