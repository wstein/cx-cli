// test-lane: contract

import fs from "node:fs/promises";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { main } from "../../src/cli/main.js";
import { captureCli } from "../helpers/cli/captureCli.js";
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

async function createProject(options?: {
  includeLinkedNotes?: boolean;
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
  workspaceRoots.push(workspace.rootDir);
  return {
    root: workspace.rootDir,
    configPath: workspace.configPath,
  };
}

describe("CLI JSON contract", () => {
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
  });

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
      selection?: { sections?: string[]; files?: string[] };
      summary?: { fileCount?: number };
    }>(result.stdout);
    expect(payload.selection?.sections).toEqual(["src"]);
    expect(payload.selection?.files).toEqual(["src/index.ts"]);
    expect(payload.summary?.fileCount).toBe(1);
  });
});
