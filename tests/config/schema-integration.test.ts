// test-lane: integration

import { exec } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { parse as parseToml } from "smol-toml";
import { describe, expect, test } from "vitest";
import { main } from "../../src/cli/main.js";
import { loadCxConfig } from "../../src/config/load.js";
import { captureCli } from "../helpers/cli/captureCli.js";

async function loadQuietCxConfig(configPath: string) {
  return loadCxConfig(configPath, undefined, undefined, {
    emitBehaviorLogs: false,
  });
}

/**
 * End-to-end integration tests for JSON Schema support.
 * Validates that:
 * - cx init generates schema directive at line 1
 * - smol-toml parser ignores the comment
 * - load.ts correctly parses the result
 */
describe("JSON Schema Integration", () => {
  test("cx init --stdout includes schema directive at line 1", async () => {
    const { stdout: output, exitCode } = await captureCli({
      run: () => main(["init", "--stdout"]),
    });
    expect(exitCode).toBe(0);

    const lines = output.split("\n");
    expect(lines[0]).toBe(
      "#:schema https://wstein.github.io/cx-cli/schemas/cx-config-v1.schema.json",
    );
    expect(lines).toContain("schema_version = 1");
  });

  test("cx init --name preserves schema directive", async () => {
    const { stdout: output, exitCode } = await captureCli({
      run: () => main(["init", "--name", "myproject", "--stdout"]),
    });
    expect(exitCode).toBe(0);

    const lines = output.split("\n");
    expect(lines[0]).toBe(
      "#:schema https://wstein.github.io/cx-cli/schemas/cx-config-v1.schema.json",
    );
    expect(output).toContain('project_name = "myproject"');
    expect(output).toContain("schema_version = 1");
  });

  test("cx init --style preserves schema directive", async () => {
    const { stdout: output, exitCode } = await captureCli({
      run: () =>
        main(["init", "--name", "demo", "--style", "json", "--stdout"]),
    });
    expect(exitCode).toBe(0);

    const lines = output.split("\n");
    expect(lines[0]).toBe(
      "#:schema https://wstein.github.io/cx-cli/schemas/cx-config-v1.schema.json",
    );
    expect(output).toContain('style = "json"');
  });

  test("smol-toml safely ignores schema directive comment", async () => {
    const tomlWithComment = `#:schema https://wstein.github.io/cx-cli/schemas/cx-config-v1.schema.json
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
    const configContent = `#:schema https://wstein.github.io/cx-cli/schemas/cx-config-v1.schema.json
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

    const config = await loadQuietCxConfig(configPath);
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

      expect(lines[0]).toBe(
        "#:schema https://wstein.github.io/cx-cli/schemas/cx-config-v1.schema.json",
      );
      expect(configContent).toContain("schema_version = 1");
      expect(configContent).toContain('project_name = "schema-test"');
    } finally {
      process.chdir(cwd);
    }
  });

  test("cx init creates a generic base Makefile for unknown workspace environments", async () => {
    const tempDir = await fs.mkdtemp(
      path.join(os.tmpdir(), "cx-init-makefile-"),
    );
    const cwd = process.cwd();

    try {
      process.chdir(tempDir);
      await main(["init", "--name", "makefile-test", "--force"]);

      const makefilePath = path.join(tempDir, "Makefile");
      const makefileContent = await fs.readFile(makefilePath, "utf8");

      expect(makefileContent).not.toContain("CX ?= cx");
      expect(makefileContent).not.toContain("$(CX)");
      expect(makefileContent).toContain("all: build");
      expect(makefileContent).toContain("build:");
      expect(makefileContent).toContain("clean:");
    } finally {
      process.chdir(cwd);
    }
  });

  test("cx init selects a language-specific Makefile template when the workspace has detected source files", async () => {
    const tempDir = await fs.mkdtemp(
      path.join(os.tmpdir(), "cx-init-makefile-go-"),
    );
    const cwd = process.cwd();

    try {
      process.chdir(tempDir);
      await fs.writeFile(
        path.join(tempDir, "go.mod"),
        "module example\n",
        "utf8",
      );
      await main(["init", "--name", "go-makefile-test", "--force"]);

      const makefilePath = path.join(tempDir, "Makefile");
      const makefileContent = await fs.readFile(makefilePath, "utf8");

      expect(makefileContent).toContain("GO ?= go");
      expect(makefileContent).toContain("$(GO) build ./...");
      expect(makefileContent).not.toContain("$(CX)");
      expect(makefileContent).not.toContain("bundle: build");
    } finally {
      process.chdir(cwd);
    }
  });

  test.each([
    {
      template: "typescript",
      tempDirPrefix: "cx-init-makefile-typescript-",
      markers: [
        ["package.json", "{}\n"],
        ["tsconfig.json", "{}\n"],
      ] as const,
      expectedSnippets: [
        "install: ## Install dependencies using the detected package manager.\n\t@if [ -f bun.lockb ] || [ -f bun.lock ]; then \\\n\t\t$(BUN) install; \\\n\telif [ -f pnpm-lock.yaml ]; then \\\n\t\t$(PNPM) install; \\\n\telif [ -f yarn.lock ]; then \\\n\t\t$(YARN) install; \\\n\telif [ -f package-lock.json ] || [ -f npm-shrinkwrap.json ]; then \\\n\t\t$(NPM) install; \\\n\telse \\\n\t\t$(NPM) install; \\\n\tfi",
        "build: ## Build the project using the detected package manager.\n\t@if [ -f bun.lockb ] || [ -f bun.lock ]; then \\\n\t\t$(BUN) run build; \\\n\telif [ -f pnpm-lock.yaml ]; then \\\n\t\t$(PNPM) run build; \\\n\telif [ -f yarn.lock ]; then \\\n\t\t$(YARN) run build; \\\n\telif [ -f package-lock.json ] || [ -f npm-shrinkwrap.json ]; then \\\n\t\t$(NPM) run build; \\\n\telse \\\n\t\t$(NPM) run build; \\\n\tfi",
        'help: ## Show available targets.\n\t@printf "Available targets:\\n  install build test check lint verify certify clean notes\\n"',
      ],
      unexpectedSnippets: [
        "if command -v $(BUN) >/dev/null 2>&1; then",
        "\t\t$(BUN) install && $(BUN) run build;",
      ],
    },
    {
      template: "python",
      tempDirPrefix: "cx-init-makefile-python-",
      markers: [
        ["pyproject.toml", '[project]\nname = "example"\n'],
        ["requirements.txt", "pytest\n"],
      ] as const,
      expectedSnippets: [
        'build: ## Install dependencies using pip if a requirements file is present.\n\t@if [ -f requirements.txt ]; then \\\n\t\t$(PIP) install -r requirements.txt; \\\n\telif [ -f pyproject.toml ]; then \\\n\t\t$(PYTHON) -m pip install .; \\\n\telse \\\n\t\techo "No Python dependency manifest found; skipping install."; \\\n\tfi',
        'help: ## Show available targets.\n\t@printf "Available targets:\\n  build test clean notes\\n"',
      ],
      unexpectedSnippets: [],
    },
    {
      template: "java",
      tempDirPrefix: "cx-init-makefile-java-",
      markers: [["pom.xml", "<project />\n"]] as const,
      expectedSnippets: [
        'build: ## Build the Java project using Maven or Gradle.\n\t@if [ -f pom.xml ]; then \\\n\t\t$(MAVEN) package; \\\n\telif [ -f build.gradle ] || [ -f build.gradle.kts ]; then \\\n\t\t$(GRADLE) build; \\\n\telse \\\n\t\techo "No Maven or Gradle build file found."; \\\n\t\texit 1; \\\n\tfi',
        "clean: ## Remove generated output files.\n\t@if [ -f pom.xml ]; then \\\n\t\t$(MAVEN) clean; \\\n\tfi\n\t@if [ -f build.gradle ] || [ -f build.gradle.kts ]; then \\\n\t\t$(GRADLE) clean; \\\n\tfi",
      ],
      unexpectedSnippets: [],
    },
    {
      template: "rust",
      tempDirPrefix: "cx-init-makefile-rust-",
      markers: [["Cargo.toml", '[package]\nname = "example"\n']] as const,
      expectedSnippets: [
        "build: ## Build the Rust project in release mode.\n\t$(CARGO) build --release",
        'help: ## Show available targets.\n\t@printf "Available targets:\\n  build test check verify certify clean notes\\n"',
      ],
      unexpectedSnippets: [
        '@printf "Available targets:\n  build test check clean notes\n"',
      ],
    },
  ])("cx init renders a readable %s Makefile template", async ({
    template,
    tempDirPrefix,
    markers,
    expectedSnippets,
    unexpectedSnippets,
  }) => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), tempDirPrefix));
    const cwd = process.cwd();

    try {
      process.chdir(tempDir);
      for (const [fileName, content] of markers) {
        await fs.writeFile(path.join(tempDir, fileName), content, "utf8");
      }

      await main([
        "init",
        "--name",
        `${template}-test`,
        "--template",
        template,
        "--force",
      ]);

      const makefileContent = await fs.readFile(
        path.join(tempDir, "Makefile"),
        "utf8",
      );

      for (const snippet of expectedSnippets) {
        expect(makefileContent).toContain(snippet);
      }
      for (const snippet of unexpectedSnippets) {
        expect(makefileContent).not.toContain(snippet);
      }
    } finally {
      process.chdir(cwd);
    }
  });

  test("cx init preserves existing init targets while creating missing files", async () => {
    const tempDir = await fs.mkdtemp(
      path.join(os.tmpdir(), "cx-init-existing-"),
    );
    const cwd = process.cwd();

    try {
      process.chdir(tempDir);
      await fs.mkdir(path.join(tempDir, "notes"), { recursive: true });
      await fs.writeFile(
        path.join(tempDir, "cx.toml"),
        "schema_version = 1\n",
        "utf8",
      );
      await fs.writeFile(
        path.join(tempDir, "notes/README.md"),
        "# notes\n",
        "utf8",
      );

      await expect(main(["init", "--name", "existing-test"])).resolves.toBe(0);

      const configContent = await fs.readFile(
        path.join(tempDir, "cx.toml"),
        "utf8",
      );
      expect(configContent).toBe("schema_version = 1\n");

      const makefileContent = await fs.readFile(
        path.join(tempDir, "Makefile"),
        "utf8",
      );
      expect(makefileContent).toContain("build:");

      const mcpContent = await fs.readFile(
        path.join(tempDir, "cx-mcp.toml"),
        "utf8",
      );
      expect(mcpContent).toContain(
        "#:schema https://wstein.github.io/cx-cli/schemas/cx-config-overlay-v1.schema.json",
      );
      expect(mcpContent).toContain('extends = "./cx.toml"');
      expect(mcpContent).not.toContain('project_name = "existing-test"');
    } finally {
      process.chdir(cwd);
    }
  });

  test("cx init generates cx-mcp.toml and supports explicit template selection", async () => {
    const tempDir = await fs.mkdtemp(
      path.join(os.tmpdir(), "cx-init-template-"),
    );
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
      const buildMcpContent = await fs.readFile(
        path.join(tempDir, "cx-mcp-build.toml"),
        "utf8",
      );

      expect(mcpContent).toContain(
        "#:schema https://wstein.github.io/cx-cli/schemas/cx-config-overlay-v1.schema.json",
      );
      expect(mcpContent).toContain('extends = "./cx.toml"');
      expect(mcpContent).not.toContain('project_name = "typescript-test"');
      expect(mcpContent).not.toContain('include = ["dist/src/**"]');
      expect(mcpContent).not.toContain(
        'output_dir = "dist/typescript-test-mcp-bundle"',
      );
      expect(mcpContent).not.toContain("[mcp]");
      expect(mcpContent).not.toContain("[mcp.clients.");
      expect(mcpContent).toContain('"src/**"');
      expect(mcpContent).toContain('"package.json"');
      expect(mcpContent).toContain('"tsconfig.json"');
      expect(mcpContent).toContain("exclude = [");
      expect(mcpContent).not.toContain('"node_modules/**"');
      expect(mcpContent).not.toContain('"dist/**"');
      expect(buildMcpContent).toContain('extends = "./cx.toml"');
      expect(buildMcpContent).toContain(
        'include = ["dist/**", "package.json", "README.md"]',
      );
      expect(buildMcpContent).toContain('exclude = ["coverage/**", ".git/**"]');
    } finally {
      process.chdir(cwd);
    }
  });

  test("cx init generates local MCP integration files", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "cx-init-local-"));
    const cwd = process.cwd();

    try {
      process.chdir(tempDir);
      await main(["init", "--name", "local-init-test", "--force"]);

      const rootMcpJson = await fs.readFile(
        path.join(tempDir, ".mcp.json"),
        "utf8",
      );
      expect(rootMcpJson).toContain('"command": "cx"');
      expect(rootMcpJson).toContain('"cwd": "${workspace' + 'Folder}"');

      const editorconfig = await fs.readFile(
        path.join(tempDir, ".editorconfig"),
        "utf8",
      );
      expect(editorconfig).toContain("root = true");
      expect(editorconfig).toContain("trim_trailing_whitespace = true");

      const vscodeMcpJson = await fs.readFile(
        path.join(tempDir, ".vscode", "mcp.json"),
        "utf8",
      );
      expect(vscodeMcpJson).toContain('"command": "cx"');
      expect(vscodeMcpJson).toContain('"cwd": "${workspace' + 'Folder}"');

      const claudeSettings = await fs.readFile(
        path.join(tempDir, ".claude", "settings.json"),
        "utf8",
      );
      expect(claudeSettings).toContain('"enabledMcpjsonServers": ["cx-mcp"]');

      const codexSettings = await fs.readFile(
        path.join(tempDir, ".codex", "settings.json"),
        "utf8",
      );
      expect(codexSettings).toContain('"enabledMcpjsonServers": ["cx-mcp"]');
    } finally {
      process.chdir(cwd);
    }
  });

  test("cx init prints supported templates with --template-list", async () => {
    const { stdout: output, exitCode } = await captureCli({
      run: () => main(["init", "--template-list"]),
    });
    expect(exitCode).toBe(0);

    expect(output).toContain("rust: Rust workspaces using Cargo.");
    expect(output).toContain(
      "typescript: TypeScript/Node.js workspaces using package.json.",
    );
    expect(output).toContain(
      "python: Python workspaces using pyproject.toml or requirements.txt.",
    );
    expect(output).toContain(
      "zig: Zig workspaces using build.zig or build.zig.zon.",
    );
  });

  test("init templates are included in dist after build", {
    timeout: 20000,
  }, async () => {
    const root = process.cwd();
    const distPath = path.join(root, "dist", "src", "templates", "init");
    await fs.rm(path.join(root, "dist"), { recursive: true, force: true });

    const execAsync = promisify(exec);
    const { stdout } = await execAsync("bun run build", { cwd: root });
    expect(stdout).toContain("Copied init templates from");

    const makefileExists = await fs
      .access(path.join(distPath, "base", "Makefile.hbs"))
      .then(
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
      const config = await loadQuietCxConfig(configPath);

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

    const configWithDirective = `#:schema https://wstein.github.io/cx-cli/schemas/cx-config-v1.schema.json
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

    const config = await loadQuietCxConfig(configPath);
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

    const tomlWithDirective = `#:schema https://wstein.github.io/cx-cli/schemas/cx-config-v1.schema.json
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
