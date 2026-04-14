import { describe, expect, test } from "bun:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import { parse as parseToml } from "smol-toml";
import { main } from "../../src/cli/main.js";
import { loadCxConfig } from "../../src/config/load.js";

/**
 * End-to-end integration tests for JSON Schema support.
 * Validates that:
 * - cx init generates schema directive at line 1
 * - smol-toml parser ignores the comment
 * - load.ts correctly parses the result
 */
describe("JSON Schema Integration", () => {
  test("cx init --stdout includes schema directive at line 1", async () => {
    const write = process.stdout.write;
    let output = "";
    process.stdout.write = ((chunk: string | Uint8Array) => {
      output += String(chunk);
      return true;
    }) as typeof process.stdout.write;

    try {
      await main(["init", "--stdout"]);
    } finally {
      process.stdout.write = write;
    }

    const lines = output.split("\n");
    expect(lines[0]).toBe("#:schema ./schemas/cx-config-v1.schema.json");
    expect(lines[1]).toContain("schema_version = 1");
  });

  test("cx init --name preserves schema directive", async () => {
    const write = process.stdout.write;
    let output = "";
    process.stdout.write = ((chunk: string | Uint8Array) => {
      output += String(chunk);
      return true;
    }) as typeof process.stdout.write;

    try {
      await main(["init", "--name", "myproject", "--stdout"]);
    } finally {
      process.stdout.write = write;
    }

    const lines = output.split("\n");
    expect(lines[0]).toBe("#:schema ./schemas/cx-config-v1.schema.json");
    expect(output).toContain('project_name = "myproject"');
    expect(output).toContain("schema_version = 1");
  });

  test("cx init --style preserves schema directive", async () => {
    const write = process.stdout.write;
    let output = "";
    process.stdout.write = ((chunk: string | Uint8Array) => {
      output += String(chunk);
      return true;
    }) as typeof process.stdout.write;

    try {
      await main(["init", "--name", "demo", "--style", "json", "--stdout"]);
    } finally {
      process.stdout.write = write;
    }

    const lines = output.split("\n");
    expect(lines[0]).toBe("#:schema ./schemas/cx-config-v1.schema.json");
    expect(output).toContain('style = "json"');
  });

  test("smol-toml safely ignores schema directive comment", async () => {
    const tomlWithComment = `#:schema ./schemas/cx-config-v1.schema.json
schema_version = 1
project_name = "test"
source_root = "."
output_dir = "dist/test-bundle"

[sections.src]
include = ["src/**"]
exclude = []
`;

    const parsed = parseToml(tomlWithComment) as {
      schema_version?: unknown;
      project_name?: unknown;
    };
    expect(parsed.schema_version).toBe(1);
    expect(parsed.project_name).toBe("test");
    // Comment should not appear in parsed output
    expect(Object.keys(parsed)).not.toContain("schema");
  });

  test("load.ts accepts cx.toml with schema directive", async () => {
    const tempDir = await fs.mkdtemp(
      path.join(os.tmpdir(), "cx-schema-directive-"),
    );
    const configPath = path.join(tempDir, "cx.toml");

    // Write a full config with schema directive
    const configContent = `#:schema ./schemas/cx-config-v1.schema.json
schema_version = 1
project_name = "integration-test"
source_root = "."
output_dir = "dist/integration-test-bundle"

[repomix]
style = "xml"

[sections.src]
include = ["src/**"]
exclude = []

[sections.tests]
include = ["tests/**"]
exclude = []
`;

    await fs.writeFile(configPath, configContent, "utf8");

    const config = await loadCxConfig(configPath);
    expect(config.projectName).toBe("integration-test");
    expect(config.schemaVersion).toBe(1);
    // sourceRoot is resolved to absolute path by loadCxConfig
    expect(config.sourceRoot).toContain("cx-schema-directive");
    expect(config.sections.src).toBeDefined();
    expect(config.sections.tests).toBeDefined();
  });

  test("cx init creates files with schema directive in current directory", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "cx-init-schema-"));
    const cwd = process.cwd();

    try {
      process.chdir(tempDir);
      await main(["init", "--name", "schema-test", "--force"]);

      const configPath = path.join(tempDir, "cx.toml");
      const configContent = await fs.readFile(configPath, "utf8");
      const lines = configContent.split("\n");

      expect(lines[0]).toBe("#:schema ./schemas/cx-config-v1.schema.json");
      expect(configContent).toContain("schema_version = 1");
      expect(configContent).toContain('project_name = "schema-test"');
    } finally {
      process.chdir(cwd);
    }
  });

  test("cx init creates a generic base Makefile for unknown workspace environments", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "cx-init-makefile-"));
    const cwd = process.cwd();

    try {
      process.chdir(tempDir);
      await main(["init", "--name", "makefile-test", "--force"]);

      const makefilePath = path.join(tempDir, "Makefile");
      const makefileContent = await fs.readFile(makefilePath, "utf8");

      expect(makefileContent).toContain("CX ?= cx");
      expect(makefileContent).toContain("all: build");
      expect(makefileContent).toContain("build:");
      expect(makefileContent).toContain("bundle: build");
      expect(makefileContent).toContain("$(CX) bundle --config \"$(CX_CONFIG)\"");
      expect(makefileContent).toContain("validate:");
      expect(makefileContent).toContain("inspect:");
      expect(makefileContent).toContain("clean:");
    } finally {
      process.chdir(cwd);
    }
  });

  test("cx init selects a language-specific Makefile template when the workspace has detected source files", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "cx-init-makefile-go-"));
    const cwd = process.cwd();

    try {
      process.chdir(tempDir);
      await fs.writeFile(path.join(tempDir, "go.mod"), "module example\n", "utf8");
      await main(["init", "--name", "go-makefile-test", "--force"]);

      const makefilePath = path.join(tempDir, "Makefile");
      const makefileContent = await fs.readFile(makefilePath, "utf8");

      expect(makefileContent).toContain("GO ?= go");
      expect(makefileContent).toContain("$(GO) build ./...");
      expect(makefileContent).toContain("bundle: build");
      expect(makefileContent).toContain("$(CX) bundle --config \"$(CX_CONFIG)\"");
    } finally {
      process.chdir(cwd);
    }
  });

  test("cx init generates cx-mcp.toml and supports explicit template selection", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "cx-init-template-"));
    const cwd = process.cwd();

    try {
      process.chdir(tempDir);
      await fs.writeFile(path.join(tempDir, "package.json"), "{}\n", "utf8");
      await fs.writeFile(path.join(tempDir, "tsconfig.json"), "{}\n", "utf8");

      await main([
        "init",
        "--name",
        "typescript-test",
        "--template",
        "typescript",
        "--force",
      ]);

      const mcpPath = path.join(tempDir, "cx-mcp.toml");
      const mcpContent = await fs.readFile(mcpPath, "utf8");

      expect(mcpContent).toContain("project_name = \"typescript-test\"");
      expect(mcpContent).toContain("include = [\"src/**\", \"dist/**\"]");
      expect(mcpContent).toContain("output_dir = \"dist/typescript-test-mcp-bundle\"");
    } finally {
      process.chdir(cwd);
    }
  });

  test("cx init prints supported templates with --template-list", async () => {
    const write = process.stdout.write;
    let output = "";
    process.stdout.write = ((chunk: string | Uint8Array) => {
      output += String(chunk);
      return true;
    }) as typeof process.stdout.write;

    try {
      await main(["init", "--template-list"]);
    } finally {
      process.stdout.write = write;
    }

    expect(output).toContain("rust: Rust workspaces using Cargo.");
    expect(output).toContain("typescript: TypeScript/Node.js workspaces using package.json.");
    expect(output).toContain("python: Python workspaces using pyproject.toml or requirements.txt.");
  });

  test("init templates are included in dist after build", async () => {
    const root = process.cwd();
    const distPath = path.join(root, "dist", "src", "templates", "init-templates");
    await fs.rm(path.join(root, "dist"), { recursive: true, force: true });

    const execAsync = promisify(exec);
    const { stdout } = await execAsync("bun run build", { cwd: root });
    expect(stdout).toContain("Copied init templates from");

    const makefileExists = await fs.access(
      path.join(distPath, "base", "Makefile.hbs"),
    ).then(
      () => true,
      () => false,
    );
    expect(makefileExists).toBe(true);
  });

  test("generated cx.toml is accepted by load.ts", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "cx-full-flow-"));
    const cwd = process.cwd();

    try {
      process.chdir(tempDir);
      await main(["init", "--name", "fullflow-test", "--force"]);

      const configPath = path.join(tempDir, "cx.toml");
      const config = await loadCxConfig(configPath);

      expect(config.projectName).toBe("fullflow-test");
      expect(config.schemaVersion).toBe(1);
      expect(config.sections).toBeDefined();
      expect(Object.keys(config.sections).length).toBeGreaterThan(0);
    } finally {
      process.chdir(cwd);
    }
  });

  test("schema directive does not interfere with config parsing", async () => {
    const tempDir = await fs.mkdtemp(
      path.join(os.tmpdir(), "cx-directive-parse-"),
    );
    const configPath = path.join(tempDir, "cx.toml");

    const configWithDirective = `#:schema ./schemas/cx-config-v1.schema.json
schema_version = 1
project_name = "parse-test"
source_root = "."
output_dir = "dist/parse-test"

[sections.code]
include = ["src/**", "lib/**"]
exclude = ["**/*.test.ts"]
priority = 10

[sections.tests]
include = ["**/*.test.ts"]
exclude = []
priority = 5
`;

    await fs.writeFile(configPath, configWithDirective, "utf8");

    const config = await loadCxConfig(configPath);
    expect(config.sections.code?.include).toEqual(["src/**", "lib/**"]);
    expect(config.sections.code?.exclude).toEqual(["**/*.test.ts"]);
    expect(config.sections.code?.priority).toBe(10);
    expect(config.sections.tests?.priority).toBe(5);
  });

  test("config with special characters in project name preserves schema directive", async () => {
    const tempDir = await fs.mkdtemp(
      path.join(os.tmpdir(), "cx-special-chars-"),
    );
    const cwd = process.cwd();

    try {
      process.chdir(tempDir);
      // This is a valid project name: alphanumeric, dots, hyphens, underscores
      await main(["init", "--name", "my-project_v1.0", "--force"]);

      const configPath = path.join(tempDir, "cx.toml");
      const configContent = await fs.readFile(configPath, "utf8");

      expect(configContent.startsWith("#:schema")).toBe(true);
      expect(configContent).toContain('project_name = "my-project_v1.0"');
    } finally {
      process.chdir(cwd);
    }
  });

  test("smol-toml output matches parsed JSON regardless of schema directive", async () => {
    const tomlWithoutDirective = `schema_version = 1
project_name = "compare"
source_root = "."

[sections.main]
include = ["main/**"]
exclude = []
`;

    const tomlWithDirective = `#:schema ./schemas/cx-config-v1.schema.json
schema_version = 1
project_name = "compare"
source_root = "."

[sections.main]
include = ["main/**"]
exclude = []
`;

    const parsedWithout = parseToml(tomlWithoutDirective);
    const parsedWith = parseToml(tomlWithDirective);

    // Both should parse identically (directive is ignored)
    expect(parsedWithout.schema_version).toBe(parsedWith.schema_version);
    expect(parsedWithout.project_name).toBe(parsedWith.project_name);
    expect(parsedWithout.source_root).toBe(parsedWith.source_root);
  });
});
