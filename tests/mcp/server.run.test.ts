import { afterEach, describe, expect, mock, test } from "bun:test";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { loadCxConfig } from "../../src/config/load.js";
import { buildConfig } from "../helpers/config/buildConfig.js";
import { createWorkspace as createTestWorkspace } from "../helpers/workspace/createWorkspace.js";

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
  const workspace = await createTestWorkspace({
    config: buildConfig({
      assets: {
        include: [],
        exclude: [],
        mode: "ignore",
        targetDir: "assets",
      },
      sections: {
        src: {
          include: ["src/**"],
          exclude: [],
        },
      },
    }),
    overlayConfig: {
      extends: "cx.toml",
      mcp: {
        policy: "unrestricted",
      },
    },
    files: {
      "src/index.ts": [
        "export const greeting = 'hello';",
        "export const target = 'world';",
      ].join("\n"),
    },
  });

  await initGitRepo(workspace.rootDir);

  return {
    mcpPath: workspace.overlayConfigPath as string,
  };
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

      await runCxMcpServer(project.mcpPath, config, {
        processExit: exit,
        installSignalHandlers: false,
      });

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
      const stderr = mock((_message: string) => {});
      const { runCxMcpServer } = await import("../../src/mcp/server.js");

      await runCxMcpServer(project.mcpPath, config, {
        processExit: exit,
        writeStderr: stderr,
        installSignalHandlers: false,
      });

      expect(connect).toHaveBeenCalledTimes(1);
      expect(close).not.toHaveBeenCalled();
      expect(stderr).toHaveBeenCalledTimes(1);
      const firstWrite = stderr.mock.calls[0]?.[0];
      expect(typeof firstWrite).toBe("string");
      expect(firstWrite).toContain("failed to start cx mcp server");
      expect(firstWrite).toContain("connect failed");
      expect(exit).toHaveBeenCalledWith(1);
    } finally {
      proto.connect = originalConnect;
      proto.close = originalClose;
    }
  });

  test("exits 1 when connect hangs beyond timeout", async () => {
    const connect = mock(
      () =>
        new Promise<void>(() => {
          // Intentionally unresolved to simulate a stalled boundary handshake.
        }),
    );
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
      const stderr = mock((_message: string) => {});
      const { runCxMcpServer } = await import("../../src/mcp/server.js");

      await runCxMcpServer(project.mcpPath, config, {
        processExit: exit,
        writeStderr: stderr,
        connectTimeoutMs: 20,
        installSignalHandlers: false,
      });

      expect(connect).toHaveBeenCalledTimes(1);
      expect(close).not.toHaveBeenCalled();
      expect(stderr).toHaveBeenCalledTimes(1);
      const firstWrite = stderr.mock.calls[0]?.[0];
      expect(typeof firstWrite).toBe("string");
      expect(firstWrite).toContain("timed out");
      expect(exit).toHaveBeenCalledWith(1);
    } finally {
      proto.connect = originalConnect;
      proto.close = originalClose;
    }
  });
});
