// test-lane: adversarial

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { afterEach, describe, expect, test, vi } from "vitest";
import { loadCxConfig } from "../../src/config/load.js";
import { buildConfig } from "../helpers/config/buildConfig.js";
import { createWorkspace as createTestWorkspace } from "../helpers/workspace/createWorkspace.js";

const execFileAsync = promisify(execFile);

afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
});

async function loadQuietCxConfig(configPath: string) {
  return loadCxConfig(configPath, undefined, undefined, {
    emitBehaviorLogs: false,
  });
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
    const connect = vi.fn(async () => {});
    const close = vi.fn(async () => {});
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
      const config = await loadQuietCxConfig(project.mcpPath);
      const exit = vi.fn(() => {});
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
    const connect = vi.fn(async () => {
      throw new Error("connect failed");
    });
    const close = vi.fn(async () => {});
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
      const config = await loadQuietCxConfig(project.mcpPath);
      const exit = vi.fn(() => {});
      const stderr = vi.fn((_message: string) => {});
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
    const connect = vi.fn(
      () =>
        new Promise<void>(() => {
          // Intentionally unresolved to simulate a stalled boundary handshake.
        }),
    );
    const close = vi.fn(async () => {});
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
      const config = await loadQuietCxConfig(project.mcpPath);
      const exit = vi.fn(() => {});
      const stderr = vi.fn((_message: string) => {});
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

  test("exits 1 when delayed connect failure arrives before timeout", async () => {
    const connect = vi.fn(
      () =>
        new Promise<void>((_resolve, reject) => {
          setTimeout(() => reject(new Error("delayed startup failure")), 25);
        }),
    );
    const close = vi.fn(async () => {});
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
      const config = await loadQuietCxConfig(project.mcpPath);
      const exit = vi.fn(() => {});
      const stderr = vi.fn((_message: string) => {});
      const { runCxMcpServer } = await import("../../src/mcp/server.js");

      await runCxMcpServer(project.mcpPath, config, {
        processExit: exit,
        writeStderr: stderr,
        connectTimeoutMs: 200,
        installSignalHandlers: false,
      });

      expect(connect).toHaveBeenCalledTimes(1);
      expect(close).not.toHaveBeenCalled();
      expect(stderr).toHaveBeenCalledTimes(1);
      const firstWrite = stderr.mock.calls[0]?.[0];
      expect(typeof firstWrite).toBe("string");
      expect(firstWrite).toContain("delayed startup failure");
      expect(firstWrite).not.toContain("timed out");
      expect(exit).toHaveBeenCalledWith(1);
    } finally {
      proto.connect = originalConnect;
      proto.close = originalClose;
    }
  });

  test("exits 1 with structured reason when connect rejects a non-Error payload", async () => {
    const connect = vi.fn(async () => {
      throw { stage: "handshake", detail: "malformed startup payload" };
    });
    const close = vi.fn(async () => {});
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
      const config = await loadQuietCxConfig(project.mcpPath);
      const exit = vi.fn(() => {});
      const stderr = vi.fn((_message: string) => {});
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
      expect(firstWrite).toContain('"stage":"handshake"');
      expect(firstWrite).toContain('"detail":"malformed startup payload"');
      expect(exit).toHaveBeenCalledWith(1);
    } finally {
      proto.connect = originalConnect;
      proto.close = originalClose;
    }
  });

  test("exits 1 when post-connect readiness check fails after connect resolves", async () => {
    const connect = vi.fn(async () => {});
    const close = vi.fn(async () => {});
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
      const config = await loadQuietCxConfig(project.mcpPath);
      const exit = vi.fn(() => {});
      const stderr = vi.fn((_message: string) => {});
      const postConnectCheck = vi.fn(async () => {
        throw new Error(
          "startup state incomplete: capabilities snapshot missing",
        );
      });
      const { runCxMcpServer } = await import("../../src/mcp/server.js");

      await runCxMcpServer(project.mcpPath, config, {
        processExit: exit,
        writeStderr: stderr,
        postConnectCheck,
        installSignalHandlers: false,
      });

      expect(connect).toHaveBeenCalledTimes(1);
      expect(postConnectCheck).toHaveBeenCalledTimes(1);
      expect(close).not.toHaveBeenCalled();
      expect(stderr).toHaveBeenCalledTimes(1);
      const firstWrite = stderr.mock.calls[0]?.[0];
      expect(typeof firstWrite).toBe("string");
      expect(firstWrite).toContain("failed to start cx mcp server");
      expect(firstWrite).toContain("startup state incomplete");
      expect(exit).toHaveBeenCalledWith(1);
    } finally {
      proto.connect = originalConnect;
      proto.close = originalClose;
    }
  });

  test("exits 1 when post-connect readiness check hangs beyond timeout", async () => {
    const connect = vi.fn(async () => {});
    const close = vi.fn(async () => {});
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
      const config = await loadQuietCxConfig(project.mcpPath);
      const exit = vi.fn(() => {});
      const stderr = vi.fn((_message: string) => {});
      const postConnectCheck = vi.fn(
        () =>
          new Promise<void>(() => {
            // Intentionally unresolved to simulate fragmented runtime startup.
          }),
      );
      const { runCxMcpServer } = await import("../../src/mcp/server.js");

      await runCxMcpServer(project.mcpPath, config, {
        processExit: exit,
        writeStderr: stderr,
        postConnectCheck,
        postConnectTimeoutMs: 20,
        installSignalHandlers: false,
      });

      expect(connect).toHaveBeenCalledTimes(1);
      expect(postConnectCheck).toHaveBeenCalledTimes(1);
      expect(close).not.toHaveBeenCalled();
      expect(stderr).toHaveBeenCalledTimes(1);
      const firstWrite = stderr.mock.calls[0]?.[0];
      expect(typeof firstWrite).toBe("string");
      expect(firstWrite).toContain("post-connect readiness check timed out");
      expect(exit).toHaveBeenCalledWith(1);
    } finally {
      proto.connect = originalConnect;
      proto.close = originalClose;
    }
  });

  test("exits 1 when delayed fragmented runtime payload fails post-connect checks", async () => {
    const connect = vi.fn(async () => {});
    const close = vi.fn(async () => {});
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
      const config = await loadQuietCxConfig(project.mcpPath);
      const exit = vi.fn(() => {});
      const stderr = vi.fn((_message: string) => {});
      const postConnectCheck = vi.fn(
        () =>
          new Promise<void>((_resolve, reject) => {
            setTimeout(
              () =>
                reject(
                  new Error(
                    "fragmented tool-result payload: runtime frame ended mid-content",
                  ),
                ),
              25,
            );
          }),
      );
      const { runCxMcpServer } = await import("../../src/mcp/server.js");

      await runCxMcpServer(project.mcpPath, config, {
        processExit: exit,
        writeStderr: stderr,
        postConnectCheck,
        postConnectTimeoutMs: 200,
        installSignalHandlers: false,
      });

      expect(connect).toHaveBeenCalledTimes(1);
      expect(postConnectCheck).toHaveBeenCalledTimes(1);
      expect(close).not.toHaveBeenCalled();
      expect(stderr).toHaveBeenCalledTimes(1);
      const firstWrite = stderr.mock.calls[0]?.[0];
      expect(typeof firstWrite).toBe("string");
      expect(firstWrite).toContain("fragmented tool-result payload");
      expect(firstWrite).not.toContain("timed out");
      expect(exit).toHaveBeenCalledWith(1);
    } finally {
      proto.connect = originalConnect;
      proto.close = originalClose;
    }
  });

  test("formats non-Error post-connect failures with primitive reasons", async () => {
    const connect = vi.fn(async () => {});
    const close = vi.fn(async () => {});
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
      const config = await loadQuietCxConfig(project.mcpPath);
      const exit = vi.fn(() => {});
      const stderr = vi.fn((_message: string) => {});
      const postConnectCheck = vi.fn(async () => {
        throw "degraded startup payload";
      });
      const { runCxMcpServer } = await import("../../src/mcp/server.js");

      await runCxMcpServer(project.mcpPath, config, {
        processExit: exit,
        writeStderr: stderr,
        postConnectCheck,
        installSignalHandlers: false,
      });

      expect(connect).toHaveBeenCalledTimes(1);
      expect(postConnectCheck).toHaveBeenCalledTimes(1);
      expect(close).not.toHaveBeenCalled();
      expect(stderr).toHaveBeenCalledTimes(1);
      const firstWrite = stderr.mock.calls[0]?.[0];
      expect(typeof firstWrite).toBe("string");
      expect(firstWrite).toContain("degraded startup payload");
      expect(exit).toHaveBeenCalledWith(1);
    } finally {
      proto.connect = originalConnect;
      proto.close = originalClose;
    }
  });

  test("serializes structured fragmented runtime payload failures", async () => {
    const connect = vi.fn(async () => {});
    const close = vi.fn(async () => {});
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
      const config = await loadQuietCxConfig(project.mcpPath);
      const exit = vi.fn(() => {});
      const stderr = vi.fn((_message: string) => {});
      const postConnectCheck = vi.fn(async () => {
        throw {
          stage: "runtime",
          detail: "fragmented tool-result payload",
          boundary: "stdio",
          fragmentsReceived: 2,
        };
      });
      const { runCxMcpServer } = await import("../../src/mcp/server.js");

      await runCxMcpServer(project.mcpPath, config, {
        processExit: exit,
        writeStderr: stderr,
        postConnectCheck,
        installSignalHandlers: false,
      });

      expect(connect).toHaveBeenCalledTimes(1);
      expect(postConnectCheck).toHaveBeenCalledTimes(1);
      expect(close).not.toHaveBeenCalled();
      expect(stderr).toHaveBeenCalledTimes(1);
      const firstWrite = stderr.mock.calls[0]?.[0];
      expect(typeof firstWrite).toBe("string");
      expect(firstWrite).toContain('"stage":"runtime"');
      expect(firstWrite).toContain('"detail":"fragmented tool-result payload"');
      expect(firstWrite).toContain('"boundary":"stdio"');
      expect(exit).toHaveBeenCalledWith(1);
    } finally {
      proto.connect = originalConnect;
      proto.close = originalClose;
    }
  });
});
