import { afterEach, describe, expect, mock, test } from "bun:test";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { loadCxConfig } from "../../src/config/load.js";

const execFileAsync = promisify(execFile);

afterEach(() => {
  mock.restore();
});

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

[mcp]
policy = "unrestricted"
`,
    "utf8",
  );

  await initGitRepo(root);

  return { mcpPath };
}

describe("runCxMcpServer", () => {
  test("connects and exits cleanly on success", async () => {
    const connect = mock(async () => {});
    const close = mock(async () => {});
    const proto = McpServer.prototype as unknown as {
      connect: typeof connect;
      close: typeof close;
    };
    const originalConnect = proto.connect;
    const originalClose = proto.close;
    proto.connect = connect;
    proto.close = close;

    try {
      const project = await createWorkspace();
      const config = await loadCxConfig(project.mcpPath);
      const exit = mock(() => {});
      const { runCxMcpServer } = await import("../../src/mcp/server.js");

      await runCxMcpServer(project.mcpPath, config, { processExit: exit });

      expect(connect).toHaveBeenCalledTimes(1);
      expect(close).not.toHaveBeenCalled();
      expect(exit).not.toHaveBeenCalled();
    } finally {
      proto.connect = originalConnect;
      proto.close = originalClose;
    }
  });

  test("exits 1 when connect fails", async () => {
    const connect = mock(async () => {
      throw new Error("connect failed");
    });
    const close = mock(async () => {});
    const proto = McpServer.prototype as unknown as {
      connect: typeof connect;
      close: typeof close;
    };
    const originalConnect = proto.connect;
    const originalClose = proto.close;
    proto.connect = connect;
    proto.close = close;

    try {
      const project = await createWorkspace();
      const config = await loadCxConfig(project.mcpPath);
      const exit = mock(() => {});
      const { runCxMcpServer } = await import("../../src/mcp/server.js");

      await runCxMcpServer(project.mcpPath, config, { processExit: exit });

      expect(connect).toHaveBeenCalledTimes(1);
      expect(close).not.toHaveBeenCalled();
      expect(exit).toHaveBeenCalledWith(1);
    } finally {
      proto.connect = originalConnect;
      proto.close = originalClose;
    }
  });
});
