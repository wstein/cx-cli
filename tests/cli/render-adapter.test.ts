// test-lane: integration

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, test } from "vitest";

import { runAdapterCommand } from "../../src/cli/commands/adapter.js";
import { runRenderCommand } from "../../src/cli/commands/render.js";
import { CX_DISPLAY_VERSION, CX_VERSION } from "../../src/shared/version.js";
import { createBufferedCommandIo } from "../helpers/cli/createBufferedCommandIo.js";
import { parseJsonOutput } from "../helpers/cli/parseJsonOutput.js";

async function createRenderTestProject(): Promise<{
  root: string;
  configPath: string;
}> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "cx-render-"));
  await fs.mkdir(path.join(root, "src"), { recursive: true });
  await fs.mkdir(path.join(root, "docs"), { recursive: true });
  await fs.writeFile(
    path.join(root, "README.md"),
    "# Project\n\nContent here.\n",
    "utf8",
  );
  await fs.writeFile(
    path.join(root, "src", "index.ts"),
    'export const greeting = "hello";\n',
    "utf8",
  );
  await fs.writeFile(
    path.join(root, "docs", "guide.md"),
    "# Guide\n\nGuide content.\n",
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

[sections.docs]
include = ["README.md", "docs/**"]
exclude = []

[sections.src]
include = ["src/**"]
exclude = []
`,
    "utf8",
  );

  return { root, configPath };
}

function createProjectIo(projectRoot: string) {
  return createBufferedCommandIo({ cwd: projectRoot });
}

describe("render command", () => {
  test("renders a single section to stdout", async () => {
    const project = await createRenderTestProject();
    const capture = createProjectIo(project.root);
    const exitCode = await runRenderCommand(
      {
        config: project.configPath,
        sections: ["src"],
        stdout: true,
      },
      capture.io,
    );
    expect(exitCode).toBe(0);

    const output = capture.stdout();
    expect(output).toContain("cx section handover");
    expect(output).toContain(
      "artifact: deterministic section snapshot for human and AI review.",
    );
    expect(output).toContain(
      "usage: review and cite the logical paths in this snapshot, but make repository edits in the original source tree.",
    );
    expect(output).toContain("<file");
    expect(output).toContain("index.ts");
  });

  test("renders all sections to output directory", async () => {
    const project = await createRenderTestProject();
    const outputDir = path.join(project.root, "render-output");
    const capture = createProjectIo(project.root);
    expect(
      await runRenderCommand(
        {
          config: project.configPath,
          allSections: true,
          outputDir,
        },
        capture.io,
      ),
    ).toBe(0);

    const files = await fs.readdir(outputDir);
    expect(files).toContain("demo-repomix-docs.xml.txt");
    expect(files).toContain("demo-repomix-src.xml.txt");
  });

  test("renders with style override", async () => {
    const project = await createRenderTestProject();
    const capture = createProjectIo(project.root);
    const exitCode = await runRenderCommand(
      {
        config: project.configPath,
        sections: ["src"],
        style: "markdown",
        stdout: true,
      },
      capture.io,
    );
    expect(exitCode).toBe(0);

    const output = capture.stdout();
    expect(output).toContain("index.ts");
    expect(output).not.toContain("<file");
  });

  test("emits JSON metadata for multiple sections", async () => {
    const project = await createRenderTestProject();
    const capture = createProjectIo(project.root);
    const exitCode = await runRenderCommand(
      {
        config: project.configPath,
        allSections: true,
        json: true,
      },
      capture.io,
    );
    expect(exitCode).toBe(0);

    const payload = parseJsonOutput<{
      projectName?: string;
      selection?: { sections?: string[] };
      outputs?: Array<{
        section: string;
        fileCount: number;
        tokenCount: number;
      }>;
    }>(capture.stdout());

    expect(payload.projectName).toBe("demo");
    expect(payload.selection?.sections?.sort()).toEqual(["docs", "src"]);
    expect(payload.outputs?.length).toBe(2);
    for (const entry of payload.outputs ?? []) {
      expect(entry.tokenCount).toBeGreaterThan(0);
    }
  });

  test("fails with no selection", async () => {
    const project = await createRenderTestProject();
    await expect(
      runRenderCommand(
        {
          config: project.configPath,
        },
        createProjectIo(project.root).io,
      ),
    ).rejects.toThrow("Selection required");
  });

  test("fails with unknown section", async () => {
    const project = await createRenderTestProject();
    await expect(
      runRenderCommand(
        {
          config: project.configPath,
          sections: ["nonexistent"],
        },
        createProjectIo(project.root).io,
      ),
    ).rejects.toThrow("not found in plan");
  });

  test("renders by specific file selection", async () => {
    const project = await createRenderTestProject();
    const capture = createProjectIo(project.root);
    const exitCode = await runRenderCommand(
      {
        config: project.configPath,
        files: ["src/index.ts"],
        stdout: true,
      },
      capture.io,
    );
    expect(exitCode).toBe(0);

    const output = capture.stdout();
    expect(output).toContain("index.ts");
  });
});

describe("adapter command", () => {
  test("adapter capabilities shows runtime info", async () => {
    const capture = createBufferedCommandIo();
    const exitCode = await runAdapterCommand(
      {
        subcommand: "capabilities",
      },
      capture.io,
    );
    expect(exitCode).toBe(0);

    const output = capture.stdout();
    expect(output).toContain("cx version");
    expect(output).toContain(CX_DISPLAY_VERSION);
    expect(output).toContain("Repomix version");
    expect(output).toContain("xml");
  });

  test("adapter capabilities emits JSON", async () => {
    const capture = createBufferedCommandIo();
    const exitCode = await runAdapterCommand(
      {
        subcommand: "capabilities",
        json: true,
      },
      capture.io,
    );
    expect(exitCode).toBe(0);

    const payload = parseJsonOutput<{
      cx?: { version?: string };
      capabilities?: { styles?: string[] };
    }>(capture.stdout());

    expect(payload.cx?.version).toBe(CX_VERSION);
    expect(payload.capabilities?.styles).toContain("xml");
  });

  test("adapter inspect requires section", async () => {
    const project = await createRenderTestProject();
    await expect(
      runAdapterCommand(
        {
          config: project.configPath,
          subcommand: "inspect",
        },
        createProjectIo(project.root).io,
      ),
    ).rejects.toThrow("inspect requires --section");
  });

  test("adapter inspect shows section details", async () => {
    const project = await createRenderTestProject();
    const capture = createProjectIo(project.root);
    expect(
      await runAdapterCommand(
        {
          config: project.configPath,
          subcommand: "inspect",
          sections: ["src"],
        },
        capture.io,
      ),
    ).toBe(0);

    const output = capture.stdout();
    expect(output).toContain("Section: src");
    expect(output).toContain("index.ts");
  });

  test("adapter inspect emits JSON with files", async () => {
    const project = await createRenderTestProject();
    const capture = createProjectIo(project.root);
    expect(
      await runAdapterCommand(
        {
          config: project.configPath,
          subcommand: "inspect",
          sections: ["src"],
          json: true,
        },
        capture.io,
      ),
    ).toBe(0);

    const payload = parseJsonOutput<{
      sections?: Array<{ name: string; files?: string[] }>;
    }>(capture.stdout());

    expect(payload.sections?.[0]?.name).toBe("src");
    expect(payload.sections?.[0]?.files).toContain("src/index.ts");
  });

  test("adapter doctor runs checks", async () => {
    const capture = createBufferedCommandIo();
    const exitCode = await runAdapterCommand(
      {
        subcommand: "doctor",
      },
      capture.io,
    );
    expect(exitCode).toBe(0);

    const output = capture.stdout();
    expect(output).toContain("available");
    expect(output).toContain("Adapter contract");
    expect(output).toContain("All checks passed");
  });

  test("adapter doctor emits JSON results", async () => {
    const capture = createBufferedCommandIo();
    const exitCode = await runAdapterCommand(
      {
        subcommand: "doctor",
        json: true,
      },
      capture.io,
    );
    expect(exitCode).toBe(0);

    const payload = parseJsonOutput<{
      passed?: boolean;
      checks?: Array<{ name: string; passed: boolean }>;
    }>(capture.stdout());

    expect(payload.passed).toBe(true);
    expect(payload.checks?.length).toBeGreaterThan(0);
  });
});
