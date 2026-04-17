import { describe, expect, test } from "bun:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { main } from "../../src/cli/main.js";
import { MANIFEST_SCHEMA_VERSION } from "../../src/manifest/json.js";

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

describe("main JSON lane", () => {
  test("supports init JSON output", async () => {
    const capture = captureStdout();
    try {
      await expect(
        main(["init", "--stdout", "--json", "--name", "demo", "--style", "json"]),
      ).resolves.toBe(0);
    } finally {
      capture.restore();
    }

    const payload = JSON.parse(capture.output()) as {
      projectName?: string;
      style?: string;
      config?: string;
    };
    expect(payload.projectName).toBe("demo");
    expect(payload.style).toBe("json");
    expect(payload.config).toContain('project_name = "demo"');
  });

  test("supports validate JSON output", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "cx-main-"));
    await fs.mkdir(path.join(root, "src"), { recursive: true });
    await fs.writeFile(path.join(root, "src", "index.ts"), "export const ok = 1;\n", "utf8");
    await fs.writeFile(
      path.join(root, "cx.toml"),
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

    const cwd = process.cwd();
    process.chdir(root);
    await expect(main(["bundle"])).resolves.toBe(0);

    const capture = captureStdout();
    try {
      await expect(main(["validate", "dist/demo-bundle", "--json"])).resolves.toBe(0);
    } finally {
      capture.restore();
      process.chdir(cwd);
    }

    const payload = JSON.parse(capture.output()) as {
      valid?: boolean;
      checksumFile?: string;
      schemaVersion?: number;
      bundleVersion?: number;
      summary?: { manifestName?: string; sectionCount?: number; fileCount?: number };
    };
    expect(payload.valid).toBe(true);
    expect(payload.checksumFile).toBe("demo.sha256");
    expect(payload.schemaVersion).toBe(MANIFEST_SCHEMA_VERSION);
    expect(payload.bundleVersion).toBe(1);
    expect(payload.summary?.manifestName).toBe("demo-manifest.json");
  });

  test("supports list JSON filters from command line", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "cx-main-list-"));
    await fs.mkdir(path.join(root, "src"), { recursive: true });
    await fs.mkdir(path.join(root, "docs"), { recursive: true });
    await fs.writeFile(path.join(root, "src", "index.ts"), "export const ok = 1;\n", "utf8");
    await fs.writeFile(path.join(root, "docs", "guide.md"), "# Guide\n", "utf8");
    await fs.writeFile(
      path.join(root, "cx.toml"),
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

[sections.docs]
include = ["docs/**"]
exclude = []

[sections.src]
include = ["src/**"]
exclude = []
`,
      "utf8",
    );

    const cwd = process.cwd();
    process.chdir(root);
    await expect(main(["bundle"])).resolves.toBe(0);

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
      summary?: { fileCount?: number; sectionCount?: number };
      selection?: { sections?: string[]; files?: string[] };
    };
    expect(payload.summary?.fileCount).toBe(1);
    expect(payload.summary?.sectionCount).toBe(1);
    expect(payload.selection?.sections).toEqual(["src"]);
    expect(payload.selection?.files).toEqual(["src/index.ts"]);
  });
});