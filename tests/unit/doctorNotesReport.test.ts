// test-lane: unit

import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { describe, expect, test } from "vitest";

import {
  collectDoctorNotesReport,
  printDoctorNotesReport,
} from "../../src/doctor/notes.js";
import { createBufferedCommandIo } from "../helpers/cli/createBufferedCommandIo.js";

const execFileAsync = promisify(execFile);

async function initGitRepo(root: string): Promise<void> {
  await execFileAsync("git", ["init", "-q"], { cwd: root });
  await execFileAsync("git", ["config", "user.email", "cx@example.com"], {
    cwd: root,
  });
  await execFileAsync("git", ["config", "user.name", "cx"], {
    cwd: root,
  });
  await execFileAsync("git", ["add", "."], { cwd: root });
  await execFileAsync("git", ["commit", "-q", "-m", "init"], {
    cwd: root,
  });
}

async function createProject(
  options: { includeGenerated?: boolean; addGeneratedFile?: boolean } = {},
): Promise<{ root: string; configPath: string }> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "cx-doctor-notes-"));
  await fs.mkdir(path.join(root, "notes"), { recursive: true });
  await fs.mkdir(path.join(root, "src"), { recursive: true });
  await fs.mkdir(path.join(root, "generated"), { recursive: true });

  await fs.writeFile(
    path.join(root, "src", "index.ts"),
    "export const tracked = true;\n",
    "utf8",
  );
  await fs.writeFile(
    path.join(root, "notes", "architecture.md"),
    `---
id: 20260418130000
title: Architecture
---

Tracked reference: [[src/index.ts]]
Generated reference: [[generated/client.ts]]
`,
    "utf8",
  );

  const configPath = path.join(root, "cx.toml");
  await fs.writeFile(
    configPath,
    `schema_version = 1
project_name = "demo"
source_root = "."
output_dir = "dist/demo"

[files]
include = ${options.includeGenerated === true ? '["generated/**"]' : "[]"}
exclude = ["dist/**"]
follow_symlinks = false
unmatched = "ignore"

[sections.main]
include = ["src/**"]
exclude = []
`,
    "utf8",
  );

  await initGitRepo(root);

  if (options.addGeneratedFile === true) {
    await fs.writeFile(
      path.join(root, "generated", "client.ts"),
      "export const generated = true;\n",
      "utf8",
    );
  }

  return { root, configPath };
}

describe("doctor notes report", () => {
  test("treats files included into the master list as valid note targets", async () => {
    const project = await createProject({
      includeGenerated: true,
      addGeneratedFile: true,
    });

    try {
      const report = await collectDoctorNotesReport({
        config: project.configPath,
      });
      // generated/client.ts is in the master list, so it is NOT missing or
      // outside the master list. However, no section claims it, so it is
      // flagged as an advisory "excluded_from_plan" warning.
      expect(report.missingCount).toBe(0);
      expect(report.outsideMasterListCount).toBe(0);
      expect(report.excludedFromPlanCount).toBe(1);
      expect(report.masterFileCount).toBeGreaterThanOrEqual(3);
    } finally {
      await fs.rm(project.root, { recursive: true, force: true });
    }
  });

  test("reports files present on disk but outside the master list", async () => {
    const project = await createProject({
      includeGenerated: false,
      addGeneratedFile: true,
    });

    try {
      const report = await collectDoctorNotesReport({
        config: project.configPath,
      });
      expect(report.driftCount).toBe(1);
      expect(report.outsideMasterListCount).toBe(1);
      expect(report.drifts[0]?.path).toBe("generated/client.ts");
      expect(report.drifts[0]?.status).toBe("outside_master_list");
    } finally {
      await fs.rm(project.root, { recursive: true, force: true });
    }
  });

  test("human output explains the master-list basis for the warning", async () => {
    const capture = createBufferedCommandIo();
    printDoctorNotesReport(
      {
        resolvedConfigPath: "/repo/cx.toml",
        sourceRoot: "/repo",
        totalNotes: 1,
        masterFileCount: 2,
        driftCount: 1,
        missingCount: 0,
        outsideMasterListCount: 1,
        excludedFromPlanCount: 0,
        drifts: [
          {
            fromNoteId: "20260418130000",
            fromTitle: "Architecture",
            reference: "generated/client.ts",
            path: "generated/client.ts",
            status: "outside_master_list",
          },
        ],
      },
      false,
      capture.io,
    );

    expect(capture.stdout()).toContain("planning master list");
    expect(capture.stdout()).toContain("generated/client.ts");
  });
});
