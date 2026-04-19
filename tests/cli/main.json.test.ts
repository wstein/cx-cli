// test-lane: integration

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { main } from "../../src/cli/main.js";
import { MANIFEST_SCHEMA_VERSION } from "../../src/manifest/json.js";
import { createBufferedCommandIo } from "../helpers/cli/createBufferedCommandIo.js";
import { parseJsonOutput } from "../helpers/cli/parseJsonOutput.js";

describe("main JSON lane", () => {
  test("supports init JSON output", async () => {
    const capture = createBufferedCommandIo();
    const exitCode = await main(
      ["init", "--stdout", "--json", "--name", "demo", "--style", "json"],
      capture.io,
    );
    expect(exitCode).toBe(0);

    const payload = parseJsonOutput<{
      projectName?: string;
      style?: string;
      config?: string;
    }>(capture.stdout());
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

    const bundleCapture = createBufferedCommandIo({ cwd: root });
    await expect(main(["bundle"], bundleCapture.io)).resolves.toBe(0);

    const capture = createBufferedCommandIo({ cwd: root });
    const exitCode = await main(
      ["validate", "dist/demo-bundle", "--json"],
      capture.io,
    );
    expect(exitCode).toBe(0);

    const payload = parseJsonOutput<{
      valid?: boolean;
      checksumFile?: string;
      schemaVersion?: number;
      bundleVersion?: number;
      summary?: {
        manifestName?: string;
        sectionCount?: number;
        fileCount?: number;
      };
    }>(capture.stdout());
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
    await fs.writeFile(
      path.join(root, "src", "index.ts"),
      "export const ok = 1;\n",
      "utf8",
    );
    await fs.writeFile(
      path.join(root, "docs", "guide.md"),
      "# Guide\n",
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

    const bundleCapture = createBufferedCommandIo({ cwd: root });
    await expect(main(["bundle"], bundleCapture.io)).resolves.toBe(0);

    const capture = createBufferedCommandIo({ cwd: root });
    const exitCode = await main(
      [
        "list",
        "dist/demo-bundle",
        "--json",
        "--section",
        "src",
        "--file",
        "src/index.ts",
      ],
      capture.io,
    );
    expect(exitCode).toBe(0);

    const payload = parseJsonOutput<{
      summary?: { fileCount?: number; sectionCount?: number };
      selection?: { sections?: string[]; files?: string[] };
    }>(capture.stdout());
    expect(payload.summary?.fileCount).toBe(1);
    expect(payload.summary?.sectionCount).toBe(1);
    expect(payload.selection?.sections).toEqual(["src"]);
    expect(payload.selection?.files).toEqual(["src/index.ts"]);
  });

  test("covers wrapper commands that dispatch through main", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "cx-main-coverage-"));
    const restoreDir = path.join(root, "restore");

    await fs.mkdir(path.join(root, "src"), { recursive: true });
    await fs.mkdir(path.join(root, "notes"), { recursive: true });
    await fs.writeFile(
      path.join(root, "src", "index.ts"),
      "export const ok = 1;\n",
      "utf8",
    );
    await fs.writeFile(
      path.join(root, "notes", "valid.md"),
      `---
id: 20260418120000
title: Valid Note
aliases: []
tags: []
status: current
---

This note provides a durable summary so the bundle wrapper coverage test passes governance.
`,
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

    const workspaceIo = createBufferedCommandIo({ cwd: root });

    await expect(
      main(["bundle", "--config", path.join(root, "cx.toml")], workspaceIo.io),
    ).resolves.toBe(0);

    const completionCapture = createBufferedCommandIo();
    const completionExitCode = await main(
      ["completion", "--shell", "bash"],
      completionCapture.io,
    );
    expect(completionExitCode).toBe(0);
    expect(completionCapture.stdout()).toContain(
      "###-begin-cx-completions-###",
    );

    const configCapture = createBufferedCommandIo();
    expect(
      await main(
        [
          "config",
          "show-effective",
          "--config",
          path.join(root, "cx.toml"),
          "--json",
        ],
        configCapture.io,
      ),
    ).toBe(0);
    expect(parseJsonOutput(configCapture.stdout())).toMatchObject({
      configFile: path.join(root, "cx.toml"),
      cxStrict: false,
      cliMode: null,
      settings: {
        "dedup.mode": { value: "fail", source: "compiled default" },
        "repomix.missing_extension": {
          value: "warn",
          source: "compiled default",
        },
        "config.duplicate_entry": {
          value: "fail",
          source: "compiled default",
        },
      },
    });

    const adapterCapture = createBufferedCommandIo();
    expect(
      await main(
        [
          "adapter",
          "capabilities",
          "--config",
          path.join(root, "cx.toml"),
          "--json",
        ],
        adapterCapture.io,
      ),
    ).toBe(0);
    expect(parseJsonOutput(adapterCapture.stdout())).toMatchObject({
      cx: { version: expect.any(String) },
    });

    const renderCapture = createBufferedCommandIo();
    expect(
      await main(
        [
          "render",
          "--config",
          path.join(root, "cx.toml"),
          "--section",
          "src",
          "--stdout",
        ],
        renderCapture.io,
      ),
    ).toBe(0);
    expect(renderCapture.stdout()).toContain("index.ts");

    const validateCapture = createBufferedCommandIo();
    expect(
      await main(
        ["validate", path.join(root, "dist", "demo-bundle")],
        validateCapture.io,
      ),
    ).toBe(0);
    expect(validateCapture.stdout()).toBe("");

    await expect(
      main(["verify", path.join(root, "dist", "demo-bundle")], workspaceIo.io),
    ).resolves.toBe(0);

    await expect(
      main(
        [
          "extract",
          path.join(root, "dist", "demo-bundle"),
          "--to",
          restoreDir,
          "--file",
          "src/index.ts",
        ],
        workspaceIo.io,
      ),
    ).resolves.toBe(0);

    await expect(main(["notes", "list"], workspaceIo.io)).resolves.toBe(0);
  });

  test("bundle surfaces note errors through main", async () => {
    const root = await fs.mkdtemp(
      path.join(os.tmpdir(), "cx-main-validate-fail-"),
    );

    await fs.mkdir(path.join(root, "src"), { recursive: true });
    await fs.mkdir(path.join(root, "notes"), { recursive: true });
    await fs.writeFile(
      path.join(root, "src", "index.ts"),
      "export const ok = 1;\n",
      "utf8",
    );
    await fs.writeFile(
      path.join(root, "notes", "broken.md"),
      `---
id: 20260418120001
title: Broken Note
status: current
tags:
  - 123
---

Body.
`,
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

    const capture = createBufferedCommandIo({ cwd: root });
    await expect(
      main(["bundle", "--config", path.join(root, "cx.toml")], capture.io),
    ).rejects.toThrow("Note validation failed");
  });
});
