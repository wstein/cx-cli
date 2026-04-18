// test-lane: unit
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { runInitCommand } from "../../src/cli/commands/init.js";
import { createBufferedCommandIo } from "../helpers/cli/createBufferedCommandIo.js";
import { parseJsonOutput } from "../helpers/cli/parseJsonOutput.js";
import { assertTextSnapshot } from "../helpers/snapshot/assertSnapshot.js";

let testDir: string;
let origCwd: string;

const BASE_ARGS = {
  force: false,
  interactive: false,
  stdout: false,
  templateList: false,
  name: "testproject",
  style: "xml" as const,
};

async function initializeTypescriptTemplate(
  rootDir: string,
  projectName = "typescript-test",
  capture = createBufferedCommandIo({ cwd: rootDir }),
) {
  await fs.writeFile(
    path.join(rootDir, "package.json"),
    JSON.stringify({ name: projectName, private: true }, null, 2),
    "utf8",
  );
  await fs.writeFile(path.join(rootDir, "tsconfig.json"), "{}\n", "utf8");

  const exitCode = await runInitCommand(
    {
      ...BASE_ARGS,
      force: true,
      name: projectName,
      template: "typescript",
    },
    capture.io,
  );
  expect(exitCode).toBe(0);
  return capture;
}

beforeEach(async () => {
  testDir = await fs.mkdtemp(path.join(os.tmpdir(), "cx-init-test-"));
  origCwd = process.cwd();
  process.chdir(testDir);
});

afterEach(async () => {
  process.chdir(origCwd);
  await fs.rm(testDir, { recursive: true, force: true });
});

describe("runInitCommand", () => {
  test("returns 0 and creates files on first run", async () => {
    const capture = createBufferedCommandIo();
    const exitCode = await runInitCommand(BASE_ARGS, capture.io);
    expect(exitCode).toBe(0);
    const cx = await fs.readFile(path.join(testDir, "cx.toml"), "utf8");
    expect(cx).toContain("testproject");
  });

  test("second run without --force prints skip messages", async () => {
    await runInitCommand(BASE_ARGS, createBufferedCommandIo().io);

    const capture = createBufferedCommandIo();
    await runInitCommand(BASE_ARGS, capture.io);
    expect(capture.logs()).toContain("Skipped existing cx.toml");
  });

  test("json=true outputs structured JSON without writing stdout text", async () => {
    const capture = createBufferedCommandIo();
    const exitCode = await runInitCommand(
      { ...BASE_ARGS, json: true },
      capture.io,
    );
    expect(exitCode).toBe(0);
    const parsed = parseJsonOutput<Record<string, unknown>>(capture.stdout());
    expect(parsed.projectName).toBe("testproject");
    expect(parsed.style).toBe("xml");
    expect(parsed.path).toBe("cx.toml");
  });

  test("templateList=true prints available templates and returns 0", async () => {
    const capture = createBufferedCommandIo();
    const exitCode = await runInitCommand(
      { ...BASE_ARGS, templateList: true },
      capture.io,
    );
    expect(exitCode).toBe(0);
    expect(capture.stdout().length).toBeGreaterThan(0);
    expect(capture.stdout()).toContain(
      "zig: Zig workspaces using build.zig or build.zig.zon.",
    );
  });

  test("invalid project name throws CxError", async () => {
    await expect(
      runInitCommand(
        { ...BASE_ARGS, name: "../../etc/passwd" },
        createBufferedCommandIo().io,
      ),
    ).rejects.toThrow();
  });

  test("stdout=true + json=true outputs JSON to stdout without writing files", async () => {
    const capture = createBufferedCommandIo();
    const exitCode = await runInitCommand(
      { ...BASE_ARGS, stdout: true, json: true },
      capture.io,
    );
    expect(exitCode).toBe(0);
    const parsed = parseJsonOutput<Record<string, unknown>>(capture.stdout());
    expect(parsed.projectName).toBe("testproject");
    expect(parsed.config).toBeDefined();
    expect(parsed.path).toBeNull();
    const exists = await import("node:fs/promises").then((m) =>
      m
        .access(path.join(testDir, "cx.toml"))
        .then(() => true)
        .catch(() => false),
    );
    expect(exists).toBe(false);
  });

  test("stdout=true without json outputs raw config text", async () => {
    const capture = createBufferedCommandIo();
    const exitCode = await runInitCommand(
      { ...BASE_ARGS, stdout: true },
      capture.io,
    );
    expect(exitCode).toBe(0);
    expect(capture.stdout()).toContain("testproject");
    expect(capture.stdout()).toContain("schema_version");
  });

  test("force=true on second run prints 'Updated' messages", async () => {
    await runInitCommand(BASE_ARGS, createBufferedCommandIo().io);
    const capture = createBufferedCommandIo();
    await runInitCommand({ ...BASE_ARGS, force: true }, capture.io);
    expect(capture.logs()).toContain("Updated cx.toml");
  });

  test("typescript MCP overlay is source-oriented and excludes build artifacts", async () => {
    await initializeTypescriptTemplate(testDir);

    const mcpContent = await fs.readFile(
      path.join(testDir, "cx-mcp.toml"),
      "utf8",
    );

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
    expect(mcpContent).toContain('"node_modules/**"');
    expect(mcpContent).toContain('"dist/**"');
  });

  test("typescript Makefile documents lockfile-first package manager selection", async () => {
    await initializeTypescriptTemplate(testDir);

    const makefile = await fs.readFile(path.join(testDir, "Makefile"), "utf8");
    expect(makefile).toContain("[ -f bun.lockb ] || [ -f bun.lock ]");
    expect(makefile).toContain("[ -f pnpm-lock.yaml ]");
    expect(makefile).toContain("[ -f yarn.lock ]");
    expect(makefile).toContain(
      "[ -f package-lock.json ] || [ -f npm-shrinkwrap.json ]",
    );
    expect(makefile).not.toContain(
      "if command -v $(BUN) >/dev/null 2>&1; then",
    );
  });

  test("typescript Makefile keeps install separate from build", async () => {
    await initializeTypescriptTemplate(testDir);

    const makefile = await fs.readFile(path.join(testDir, "Makefile"), "utf8");
    expect(makefile).toContain("install: ## Install dependencies");
    expect(makefile).toContain("build: ## Build the project");
    expect(makefile).not.toContain("install && $(BUN) run build");
    expect(makefile).not.toContain("install && $(PNPM) run build");
    expect(makefile).not.toContain("install && $(NPM) run build");
    expect(makefile).not.toContain("install && $(YARN) run build");
  });

  test("typescript Makefile includes normalized quality targets", async () => {
    await initializeTypescriptTemplate(testDir);

    const makefile = await fs.readFile(path.join(testDir, "Makefile"), "utf8");
    expect(makefile).toContain(
      "check: ## Run typecheck/check when configured in package.json; otherwise skip.",
    );
    expect(makefile).toContain(
      "lint: ## Run lint when configured in package.json; otherwise skip.",
    );
    expect(makefile).toContain(
      "verify: ## Run the standard local quality gate.",
    );
    expect(makefile).toContain(
      "certify: ## Run certify when configured in package.json; otherwise fall back to verify.",
    );
    expect(makefile).toContain(
      "Available targets:\\n  install build test check lint verify certify clean notes",
    );
  });

  test("typescript init also generates a build-artifact MCP overlay", async () => {
    const capture = await initializeTypescriptTemplate(testDir);
    expect(capture.logs()).toContain("Created cx-mcp-build.toml");

    const buildOverlay = await fs.readFile(
      path.join(testDir, "cx-mcp-build.toml"),
      "utf8",
    );
    expect(buildOverlay).toContain('extends = "./cx.toml"');
    expect(buildOverlay).toContain(
      'include = ["dist/**", "package.json", "README.md"]',
    );
    expect(buildOverlay).toContain(
      'exclude = ["node_modules/**", "coverage/**", ".git/**"]',
    );
  });

  test("typescript init generated artifacts match the higher-level snapshot", async () => {
    await initializeTypescriptTemplate(testDir);

    const [makefile, authoringOverlay, buildOverlay] = await Promise.all([
      fs.readFile(path.join(testDir, "Makefile"), "utf8"),
      fs.readFile(path.join(testDir, "cx-mcp.toml"), "utf8"),
      fs.readFile(path.join(testDir, "cx-mcp-build.toml"), "utf8"),
    ]);

    const artifactBundle = [
      "=== Makefile ===",
      makefile.trimEnd(),
      "",
      "=== cx-mcp.toml ===",
      authoringOverlay.trimEnd(),
      "",
      "=== cx-mcp-build.toml ===",
      buildOverlay.trimEnd(),
      "",
    ].join("\n");

    await assertTextSnapshot({
      snapshotPath: path.join(
        origCwd,
        "tests/fixtures/snapshots/init/typescript-generated-artifacts.txt",
      ),
      actual: artifactBundle,
    });
  });

  test("typescript Makefile verify skips missing lint/check scripts with clear messages", async () => {
    await fs.writeFile(
      path.join(testDir, "package.json"),
      JSON.stringify(
        {
          name: "typescript-test",
          private: true,
          scripts: {
            build: `node -e "process.stdout.write('build ok\\\\n')"`,
            test: `node -e "process.stdout.write('test ok\\\\n')"`,
          },
        },
        null,
        2,
      ),
      "utf8",
    );
    await fs.writeFile(path.join(testDir, "tsconfig.json"), "{}\n", "utf8");

    const capture = createBufferedCommandIo({ cwd: testDir });
    const exitCode = await runInitCommand(
      {
        ...BASE_ARGS,
        force: true,
        name: "typescript-test",
        template: "typescript",
      },
      capture.io,
    );
    expect(exitCode).toBe(0);

    const result = spawnSync("make", ["verify"], {
      cwd: testDir,
      encoding: "utf8",
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain(
      "Skipping lint: no lint script defined in package.json",
    );
    expect(result.stdout).toContain(
      "Skipping check: no typecheck or check script defined in package.json",
    );
    expect(result.stdout).toContain("test ok");
    expect(result.stdout).toContain("build ok");
  });

  test("typescript Makefile certify falls back to verify when no certify script exists", async () => {
    await fs.writeFile(
      path.join(testDir, "package.json"),
      JSON.stringify(
        {
          name: "typescript-test",
          private: true,
          scripts: {
            build: `node -e "process.stdout.write('build ok\\\\n')"`,
            test: `node -e "process.stdout.write('test ok\\\\n')"`,
          },
        },
        null,
        2,
      ),
      "utf8",
    );
    await fs.writeFile(path.join(testDir, "tsconfig.json"), "{}\n", "utf8");

    const capture = createBufferedCommandIo({ cwd: testDir });
    const exitCode = await runInitCommand(
      {
        ...BASE_ARGS,
        force: true,
        name: "typescript-test",
        template: "typescript",
      },
      capture.io,
    );
    expect(exitCode).toBe(0);

    const result = spawnSync("make", ["certify"], {
      cwd: testDir,
      encoding: "utf8",
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain(
      "No certify script defined in package.json; falling back to make verify",
    );
    expect(result.stdout).toContain("test ok");
    expect(result.stdout).toContain("build ok");
  });
});
