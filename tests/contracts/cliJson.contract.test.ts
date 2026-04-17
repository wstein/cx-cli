import { describe, expect, test } from "bun:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { main } from "../../src/cli/main.js";

function captureStdout(): { restore: () => void; output: () => string } {
  const write = process.stdout.write;
  let output = "";
  process.stdout.write = ((chunk: string | Uint8Array) => {
    output += String(chunk);
    return true;
  }) as typeof process.stdout.write;
  return {
    restore: () => {
      process.stdout.write = write;
    },
    output: () => output,
  };
}

async function createProject(): Promise<{ root: string; configPath: string }> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "cx-cli-json-contract-"));
  await fs.mkdir(path.join(root, "src"), { recursive: true });
  await fs.writeFile(path.join(root, "src", "index.ts"), "export const ok = 1;\n", "utf8");
  const configPath = path.join(root, "cx.toml");
  await fs.writeFile(
    configPath,
    `schema_version = 1
project_name = "demo"
source_root = "."
output_dir = "dist/demo-bundle"

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
  return { root, configPath };
}

describe("CLI JSON contract", () => {
  test("inspect --json returns structured payload", async () => {
    const project = await createProject();
    const capture = captureStdout();
    try {
      await expect(main(["inspect", "--config", project.configPath, "--json"]))
        .resolves.toBe(0);
    } finally {
      capture.restore();
    }
    const payload = JSON.parse(capture.output()) as {
      summary?: { sectionCount?: number; textFileCount?: number };
      sections?: Array<{ name?: string }>;
    };
    expect(payload.summary?.sectionCount).toBeGreaterThan(0);
    expect(payload.summary?.textFileCount).toBeGreaterThan(0);
    expect(Array.isArray(payload.sections)).toBe(true);
  });

  test("doctor workflow --json returns required fields", async () => {
    const capture = captureStdout();
    try {
      await expect(
        main([
          "doctor",
          "workflow",
          "--json",
          "--task",
          "inspect a plan then update notes",
        ]),
      ).resolves.toBe(0);
    } finally {
      capture.restore();
    }

    const payload = JSON.parse(capture.output()) as {
      mode?: string;
      sequence?: string[];
      reason?: string;
      signals?: string[];
    };
    expect(typeof payload.mode).toBe("string");
    expect(Array.isArray(payload.sequence)).toBe(true);
    expect(typeof payload.reason).toBe("string");
    expect(Array.isArray(payload.signals)).toBe(true);
  });

  test("list --json returns selection metadata", async () => {
    const project = await createProject();
    const cwd = process.cwd();
    process.chdir(project.root);
    await expect(main(["bundle", "--config", project.configPath])).resolves.toBe(0);
    const capture = captureStdout();
    try {
      await expect(
        main([
          "list",
          "dist/demo-bundle",
          "--json",
          "--section",
          "src",
          "--file",
          "src/index.ts",
        ]),
      ).resolves.toBe(0);
    } finally {
      capture.restore();
      process.chdir(cwd);
    }

    const payload = JSON.parse(capture.output()) as {
      selection?: { sections?: string[]; files?: string[] };
      summary?: { fileCount?: number };
    };
    expect(payload.selection?.sections).toEqual(["src"]);
    expect(payload.selection?.files).toEqual(["src/index.ts"]);
    expect(payload.summary?.fileCount).toBe(1);
  });
});