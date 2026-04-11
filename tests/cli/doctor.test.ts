import { describe, expect, test } from "bun:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { main } from "../../src/cli/main.js";
import { loadCxConfig } from "../../src/config/load.js";
import { buildBundlePlan } from "../../src/planning/buildPlan.js";

async function createOverlapProject(): Promise<{
  root: string;
  configPath: string;
}> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "cx-doctor-"));
  await fs.mkdir(path.join(root, "src"), { recursive: true });
  await fs.writeFile(
    path.join(root, "src", "index.ts"),
    "export const value = 1;\n",
    "utf8",
  );

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

[sections.mixed]
include = ["src/**"]
`,
    "utf8",
  );

  return { root, configPath };
}

describe("doctor command", () => {
  test("doctor overlaps reports conflicts as JSON", async () => {
    const project = await createOverlapProject();
    const cwd = process.cwd();
    const write = process.stdout.write;
    let output = "";
    process.stdout.write = ((chunk: string | Uint8Array) => {
      output += String(chunk);
      return true;
    }) as typeof process.stdout.write;

    process.chdir(project.root);
    try {
      await expect(
        main(["doctor", "overlaps", "--json", "--config", project.configPath]),
      ).resolves.toBe(4);
    } finally {
      process.stdout.write = write;
      process.chdir(cwd);
    }

    const payload = JSON.parse(output) as {
      conflictCount?: number;
      conflicts?: Array<{
        path: string;
        sections: string[];
        recommendedOwner: string;
      }>;
    };

    expect(payload.conflictCount).toBe(1);
    expect(payload.conflicts?.[0]?.path).toBe("src/index.ts");
    expect(payload.conflicts?.[0]?.sections).toEqual(["src", "mixed"]);
    expect(payload.conflicts?.[0]?.recommendedOwner).toBe("src");
  });

  test("doctor fix-overlaps --dry-run leaves cx.toml unchanged", async () => {
    const project = await createOverlapProject();
    const before = await fs.readFile(project.configPath, "utf8");
    const cwd = process.cwd();
    const write = process.stdout.write;
    let output = "";
    process.stdout.write = ((chunk: string | Uint8Array) => {
      output += String(chunk);
      return true;
    }) as typeof process.stdout.write;

    process.chdir(project.root);
    try {
      await expect(
        main([
          "doctor",
          "fix-overlaps",
          "--dry-run",
          "--json",
          "--config",
          project.configPath,
        ]),
      ).resolves.toBe(4);
    } finally {
      process.stdout.write = write;
      process.chdir(cwd);
    }

    const after = await fs.readFile(project.configPath, "utf8");
    expect(after).toBe(before);

    const payload = JSON.parse(output) as {
      changed?: boolean;
      excludesBySection?: Record<string, string[]>;
    };
    expect(payload.changed).toBe(false);
    expect(payload.excludesBySection).toEqual({
      mixed: ["src/index.ts"],
    });
  });

  test("doctor fix-overlaps updates cx.toml and unblocks planning", async () => {
    const project = await createOverlapProject();
    const cwd = process.cwd();

    process.chdir(project.root);
    try {
      await expect(
        main(["doctor", "fix-overlaps", "--config", project.configPath]),
      ).resolves.toBe(0);
    } finally {
      process.chdir(cwd);
    }

    const configSource = await fs.readFile(project.configPath, "utf8");
    expect(configSource).toContain(
      '[sections.mixed]\ninclude = ["src/**"]\nexclude = ["src/index.ts"]',
    );

    const config = await loadCxConfig(project.configPath);
    await expect(buildBundlePlan(config)).resolves.toBeDefined();
  });
});
