import { describe, expect, test } from "bun:test";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { loadCxConfig } from "../../src/config/load.js";
import { createCxMcpServer } from "../../src/mcp/server.js";

const execFileAsync = promisify(execFile);

interface RegisteredTool {
  handler: (
    args: unknown,
    context: never,
  ) => Promise<{
    content: Array<{ type: "text"; text: string }>;
  }>;
}

function getRegisteredTools(server: unknown): Record<string, RegisteredTool> {
  return (server as { _registeredTools: Record<string, RegisteredTool> })
    ._registeredTools;
}

async function initGitRepo(root: string): Promise<void> {
  await execFileAsync("git", ["init", "-q"], { cwd: root });
  await execFileAsync("git", ["config", "user.email", "cx@example.com"], {
    cwd: root,
  });
  await execFileAsync("git", ["config", "user.name", "cx"], { cwd: root });
  await execFileAsync("git", ["add", "."], { cwd: root });
  await execFileAsync("git", ["commit", "-q", "-m", "init"], { cwd: root });
}

async function createWorkspace(): Promise<{
  root: string;
  configPath: string;
  mcpPath: string;
}> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "cx-mcp-server-"));
  await fs.mkdir(path.join(root, "src"), { recursive: true });
  await fs.writeFile(
    path.join(root, "src", "index.ts"),
    ["export const greeting = 'hello';", "export const target = 'world';"].join(
      "\n",
    ),
    "utf8",
  );
  await fs.writeFile(
    path.join(root, "README.md"),
    "# Workspace\n\nhello from cx\n",
    "utf8",
  );

  const configPath = path.join(root, "cx.toml");
  const mcpPath = path.join(root, "cx-mcp.toml");

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

  await fs.writeFile(
    mcpPath,
    `extends = "cx.toml"

[files]
include = ["README.md"]
`,
    "utf8",
  );

  await initGitRepo(root);

  return { root, configPath, mcpPath };
}

describe("cx MCP server", () => {
  test("registers only cx-native list, grep, and read tools", async () => {
    const project = await createWorkspace();
    const config = await loadCxConfig(project.mcpPath);
    const server = createCxMcpServer({
      configPath: project.mcpPath,
      config,
    });
    const toolNames = Object.keys(getRegisteredTools(server)).sort();

    expect(toolNames).toEqual(["grep", "list", "read"]);
  });

  test("list returns workspace files from the active cx scope", async () => {
    const project = await createWorkspace();
    const config = await loadCxConfig(project.mcpPath);
    const server = createCxMcpServer({
      configPath: project.mcpPath,
      config,
    });
    const listTool = getRegisteredTools(server).list;

    const result = await listTool.handler({}, {} as never);
    const payload = JSON.parse(result.content[0].text) as {
      fileCount: number;
      files: Array<{ path: string }>;
    };

    expect(payload.fileCount).toBeGreaterThanOrEqual(2);
    expect(payload.files.map((file) => file.path)).toContain("README.md");
    expect(payload.files.map((file) => file.path)).toContain("src/index.ts");
  });

  test("grep searches workspace files by content", async () => {
    const project = await createWorkspace();
    const config = await loadCxConfig(project.mcpPath);
    const server = createCxMcpServer({
      configPath: project.mcpPath,
      config,
    });
    const grepTool = getRegisteredTools(server).grep;

    const result = await grepTool.handler(
      {
        pattern: "hello",
        regex: false,
        caseSensitive: false,
      },
      {} as never,
    );
    const payload = JSON.parse(result.content[0].text) as {
      matchCount: number;
      matches: Array<{
        path: string;
        lineNumber: number;
        line: string;
      }>;
    };

    expect(payload.matchCount).toBeGreaterThan(0);
    expect(payload.matches.some((match) => match.path === "README.md")).toBe(
      true,
    );
    expect(
      payload.matches.some(
        (match) =>
          match.path === "src/index.ts" && match.line.includes("hello"),
      ),
    ).toBe(true);
  });

  test("read returns anchored workspace content", async () => {
    const project = await createWorkspace();
    const config = await loadCxConfig(project.mcpPath);
    const server = createCxMcpServer({
      configPath: project.mcpPath,
      config,
    });
    const readTool = getRegisteredTools(server).read;

    const result = await readTool.handler(
      {
        path: "src/index.ts",
        startLine: 2,
        endLine: 2,
      },
      {} as never,
    );
    const payload = JSON.parse(result.content[0].text) as {
      path: string;
      lineStart: number;
      lineEnd: number;
      content: string;
    };

    expect(payload.path).toBe("src/index.ts");
    expect(payload.lineStart).toBe(2);
    expect(payload.lineEnd).toBe(2);
    expect(payload.content).toContain("world");
  });
});
