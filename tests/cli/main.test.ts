import { describe, expect, test } from "bun:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { main } from "../../src/cli/main.js";

describe("main", () => {
  test("prints init template to stdout", async () => {
    const write = process.stdout.write;
    let output = "";
    process.stdout.write = ((chunk: string | Uint8Array) => {
      output += String(chunk);
      return true;
    }) as typeof process.stdout.write;

    await expect(main(["init", "--stdout"])).resolves.toBe(0);
    process.stdout.write = write;
    expect(output).toContain("schema_version = 1");
  });

  test("supports init overrides from the command line", async () => {
    const write = process.stdout.write;
    let output = "";
    process.stdout.write = ((chunk: string | Uint8Array) => {
      output += String(chunk);
      return true;
    }) as typeof process.stdout.write;

    await expect(
      main(["init", "--stdout", "--name", "demo", "--style", "json"]),
    ).resolves.toBe(0);
    process.stdout.write = write;
    expect(output).toContain('project_name = "demo"');
    expect(output).toContain('style = "json"');
  });

  test("supports init JSON output", async () => {
    const write = process.stdout.write;
    let output = "";
    process.stdout.write = ((chunk: string | Uint8Array) => {
      output += String(chunk);
      return true;
    }) as typeof process.stdout.write;

    await expect(
      main(["init", "--stdout", "--json", "--name", "demo", "--style", "json"]),
    ).resolves.toBe(0);
    process.stdout.write = write;

    const payload = JSON.parse(output) as {
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
    await fs.writeFile(
      path.join(root, "src", "index.ts"),
      "export const ok = 1;\n",
      "utf8",
    );
    await fs.writeFile(
      path.join(root, "cx.toml"),
      `schema_version = 1
project_name = "demo"
source_root = "."
output_dir = "dist/demo-bundle"

[repomix]
style = "xml"
compress = false
remove_comments = false
remove_empty_lines = false
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

    const write = process.stdout.write;
    let output = "";
    process.stdout.write = ((chunk: string | Uint8Array) => {
      output += String(chunk);
      return true;
    }) as typeof process.stdout.write;

    await expect(
      main(["validate", "dist/demo-bundle", "--json"]),
    ).resolves.toBe(0);

    process.stdout.write = write;
    process.chdir(cwd);

    const payload = JSON.parse(output) as { valid?: boolean };
    expect(payload.valid).toBe(true);
  });
});
