import { describe, expect, test } from "bun:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { main } from "../../src/cli/main.js";
import { MANIFEST_SCHEMA_VERSION } from "../../src/manifest/json.js";

describe("main", () => {
  test("prints top-level help when invoked without arguments", async () => {
    const write = process.stdout.write;
    let output = "";
    process.stdout.write = ((chunk: string | Uint8Array) => {
      output += String(chunk);
      return true;
    }) as typeof process.stdout.write;

    await expect(main([])).resolves.toBe(0);
    process.stdout.write = write;

    expect(output).toContain("cx <command> [options]");
    expect(output).toContain("extract <bundleDir>");
    expect(output).toContain("mcp");
  });

  test("prints top-level help with -h", async () => {
    const write = process.stdout.write;
    let output = "";
    process.stdout.write = ((chunk: string | Uint8Array) => {
      output += String(chunk);
      return true;
    }) as typeof process.stdout.write;

    await expect(main(["-h"])).resolves.toBe(0);
    process.stdout.write = write;

    expect(output).toContain(
      "Create an immutable bundle snapshot from a project.",
    );
    expect(output).toContain("Examples:");
  });

  test("prints the CLI version", async () => {
    const write = process.stdout.write;
    let output = "";
    process.stdout.write = ((chunk: string | Uint8Array) => {
      output += String(chunk);
      return true;
    }) as typeof process.stdout.write;

    await expect(main(["--version"])).resolves.toBe(0);
    process.stdout.write = write;

    expect(output.trim()).toBe("0.1.0");
  });

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
    expect(output).toContain("[sections.repo]");
    expect(output).toContain(
      'include = ["docs/**", "notes/**", "README.md", "*.md"]',
    );
    expect(output).not.toContain("[sections.schemas]");
    expect(output).not.toContain("[sections.scripts]");
    expect(output).toContain("[sections.tests]");
  });

  test("scaffolds repository notes when init writes files", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "cx-init-"));
    const cwd = process.cwd();

    process.chdir(root);
    try {
      await expect(main(["init", "--name", "demo"])).resolves.toBe(0);
    } finally {
      process.chdir(cwd);
    }

    const configSource = await fs.readFile(path.join(root, "cx.toml"), "utf8");
    const notesGuide = await fs.readFile(
      path.join(root, "notes", "README.md"),
      "utf8",
    );
    const notesTemplate = await fs.readFile(
      path.join(root, "notes", "template-new-zettel.md"),
      "utf8",
    );

    expect(configSource).toContain('project_name = "demo"');
    expect(configSource).toContain(
      'include = ["docs/**", "notes/**", "README.md", "*.md"]',
    );
    expect(notesGuide).toContain("# Repository Notes Guide");
    expect(notesGuide).toContain("## Before and After for Agents");
    expect(notesGuide).toContain("manifest.notes[]");
    expect(notesTemplate).toContain("id: YYYYMMDDHHMMSS");
    expect(notesTemplate).toContain("aliases: []");
    expect(notesTemplate).toContain("tags: []");
    expect(notesTemplate).toContain("## Links");
  });

  test("force init refreshes the generated notes files", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "cx-init-force-"));
    const cwd = process.cwd();

    process.chdir(root);
    try {
      await expect(main(["init", "--name", "demo"])).resolves.toBe(0);
      await fs.writeFile(
        path.join(root, "notes", "README.md"),
        "custom guide\n",
        "utf8",
      );
      await expect(main(["init", "--name", "demo", "--force"])).resolves.toBe(
        0,
      );
    } finally {
      process.chdir(cwd);
    }

    const refreshedGuide = await fs.readFile(
      path.join(root, "notes", "README.md"),
      "utf8",
    );
    expect(refreshedGuide).toContain("# Repository Notes Guide");
    expect(refreshedGuide).not.toBe("custom guide\n");
  });

  test.each([
    ["bash", "complete -o default -F"],
    ["zsh", "compdef"],
    ["fish", "complete -c"],
  ] as const)("emits completion script for %s", async (shell, expectedFragment) => {
    const write = process.stdout.write;
    let output = "";
    process.stdout.write = ((chunk: string | Uint8Array) => {
      output += String(chunk);
      return true;
    }) as typeof process.stdout.write;

    await expect(main(["completion", `--shell=${shell}`])).resolves.toBe(0);
    process.stdout.write = write;

    expect(output).toContain(expectedFragment);
    expect(output).toContain("cx");
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

  test("notes lifecycle works through main()", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "cx-notes-cli-"));
    const cwd = process.cwd();

    process.chdir(root);
    try {
      const originalWrite = process.stdout.write;
      let createOutput = "";
      process.stdout.write = ((chunk: string | Uint8Array) => {
        createOutput += String(chunk);
        return true;
      }) as typeof process.stdout.write;

      try {
        await expect(
          main([
            "notes",
            "new",
            "--title",
            "CLI Source",
            "--body",
            "Original body.",
            "--tags",
            "initial",
            "--json",
          ]),
        ).resolves.toBe(0);
      } finally {
        process.stdout.write = originalWrite;
      }

      const createdPayload = JSON.parse(createOutput) as {
        id: string;
        filePath: string;
      };
      const createdPath = createdPayload.filePath;
      expect(path.basename(createdPath)).toBe("CLI Source.md");

      const readWrite = process.stdout.write;
      let readOutput = "";
      process.stdout.write = ((chunk: string | Uint8Array) => {
        readOutput += String(chunk);
        return true;
      }) as typeof process.stdout.write;

      try {
        await expect(
          main(["notes", "read", "--id", createdPayload.id, "--json"]),
        ).resolves.toBe(0);
      } finally {
        process.stdout.write = readWrite;
      }

      const readPayload = JSON.parse(readOutput) as {
        id: string;
        title: string;
        body: string;
        tags: string[];
      };
      expect(readPayload.id).toBe(createdPayload.id);
      expect(readPayload.title).toBe("CLI Source");
      expect(readPayload.body).toContain("Original body.");
      expect(readPayload.tags).toEqual(["initial"]);

      const updateWrite = process.stdout.write;
      let updateOutput = "";
      process.stdout.write = ((chunk: string | Uint8Array) => {
        updateOutput += String(chunk);
        return true;
      }) as typeof process.stdout.write;

      try {
        await expect(
          main([
            "notes",
            "update",
            "--id",
            createdPayload.id,
            "--body",
            "Updated body.",
            "--tags",
            "revised",
            "--json",
          ]),
        ).resolves.toBe(0);
      } finally {
        process.stdout.write = updateWrite;
      }

      const updatePayload = JSON.parse(updateOutput) as {
        id: string;
        title: string;
        filePath: string;
        tags: string[];
      };
      expect(updatePayload.id).toBe(createdPayload.id);
      expect(updatePayload.title).toBe("CLI Source");
      expect(updatePayload.tags).toEqual(["revised"]);

      const updatedSource = await fs.readFile(createdPath, "utf8");
      expect(updatedSource).toContain("Updated body.");
      expect(updatedSource).toContain("revised");

      await expect(
        main([
          "notes",
          "rename",
          "--id",
          createdPayload.id,
          "--title",
          "CLI Target",
        ]),
      ).resolves.toBe(0);

      const renamedPath = path.join(root, "notes", "CLI Target.md");
      const renamedSource = await fs.readFile(renamedPath, "utf8");
      expect(renamedSource).toContain(`id: ${createdPayload.id}`);
      await expect(fs.stat(createdPath)).rejects.toThrow();

      await expect(
        main(["notes", "delete", "--id", createdPayload.id]),
      ).resolves.toBe(0);
      await expect(fs.stat(renamedPath)).rejects.toThrow();
    } finally {
      process.chdir(cwd);
    }
  });

  test("rejects invalid init names", async () => {
    await expect(
      main(["init", "--stdout", "--name", 'demo"broken']),
    ).rejects.toThrow(
      "project_name must be filesystem-safe and use only letters, numbers, dot, underscore, or hyphen.",
    );
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

    const payload = JSON.parse(output) as {
      valid?: boolean;
      checksumFile?: string;
      schemaVersion?: number;
      bundleVersion?: number;
      summary?: {
        manifestName?: string;
        sectionCount?: number;
        fileCount?: number;
      };
    };
    expect(payload.valid).toBe(true);
    expect(payload.checksumFile).toBe("demo.sha256");
    expect(payload.schemaVersion).toBe(MANIFEST_SCHEMA_VERSION);
    expect(payload.bundleVersion).toBe(1);
    expect(payload.summary?.manifestName).toBe("demo-manifest.json");
    expect(payload.summary?.sectionCount).toBe(1);
    expect(payload.summary?.fileCount).toBe(1);
  });

  test("supports list JSON filters from the command line", async () => {
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

    process.stdout.write = write;
    process.chdir(cwd);

    const payload = JSON.parse(output) as {
      display?: { list?: { bytesWarm?: number; timePalette?: number[] } };
      summary?: { fileCount?: number; sectionCount?: number };
      selection?: { sections?: string[]; files?: string[] };
    };
    expect(payload.summary?.fileCount).toBe(1);
    expect(payload.summary?.sectionCount).toBe(1);
    expect(payload.selection?.sections).toEqual(["src"]);
    expect(payload.selection?.files).toEqual(["src/index.ts"]);
    expect(payload.display?.list?.bytesWarm).toBe(4096);
    expect(payload.display?.list?.timePalette).toEqual([
      255, 254, 253, 252, 251, 250, 249, 248, 247, 246,
    ]);
  });

  test("supports inspect token breakdown from the command line", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "cx-main-inspect-"));
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

    const write = process.stdout.write;
    let output = "";
    process.stdout.write = ((chunk: string | Uint8Array) => {
      output += String(chunk);
      return true;
    }) as typeof process.stdout.write;

    try {
      await expect(
        main([
          "inspect",
          "--config",
          path.join(root, "cx.toml"),
          "--json",
          "--token-breakdown",
        ]),
      ).resolves.toBe(0);
    } finally {
      process.stdout.write = write;
    }

    const payload = JSON.parse(output) as {
      summary?: { sectionCount?: number };
      tokenBreakdown?: {
        totalTokenCount?: number;
        sections?: Array<{
          name?: string;
          fileCount?: number;
          tokenCount?: number;
          share?: number;
          bar?: string;
        }>;
      };
    };

    expect(payload.summary?.sectionCount).toBe(2);
    expect(payload.tokenBreakdown?.totalTokenCount).toBeGreaterThan(0);
    expect(
      payload.tokenBreakdown?.sections?.map((section) => section.name),
    ).toEqual(["docs", "src"]);
    expect(
      payload.tokenBreakdown?.sections?.every((section) => section.bar),
    ).toBe(true);
  });

  test("list JSON reads display settings from the user config", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "cx-main-list-user-"));
    const configHome = await fs.mkdtemp(
      path.join(os.tmpdir(), "cx-main-user-config-"),
    );
    const userConfigDir = path.join(configHome, "cx");
    const previousXdgConfigHome = process.env.XDG_CONFIG_HOME;

    await fs.mkdir(path.join(root, "src"), { recursive: true });
    await fs.mkdir(userConfigDir, { recursive: true });
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
    await fs.writeFile(
      path.join(userConfigDir, "cx.toml"),
      `[display.list]
bytes_warm = 2048
bytes_hot = 32768
tokens_warm = 256
tokens_hot = 1024
mtime_warm_minutes = 30
mtime_hot_hours = 12
time_palette = [255, 254, 253, 252, 251, 250, 249, 248]
`,
      "utf8",
    );

    process.env.XDG_CONFIG_HOME = configHome;

    const cwd = process.cwd();
    process.chdir(root);
    await expect(main(["bundle"])).resolves.toBe(0);

    const write = process.stdout.write;
    let output = "";
    process.stdout.write = ((chunk: string | Uint8Array) => {
      output += String(chunk);
      return true;
    }) as typeof process.stdout.write;

    await expect(main(["list", "dist/demo-bundle", "--json"])).resolves.toBe(0);

    process.stdout.write = write;
    process.chdir(cwd);
    process.env.XDG_CONFIG_HOME = previousXdgConfigHome;

    const payload = JSON.parse(output) as {
      display?: { list?: { bytesWarm?: number; timePalette?: number[] } };
    };
    expect(payload.display?.list?.bytesWarm).toBe(2048);
    expect(payload.display?.list?.timePalette).toEqual([
      255, 254, 253, 252, 251, 250, 249, 248,
    ]);
  });
});
