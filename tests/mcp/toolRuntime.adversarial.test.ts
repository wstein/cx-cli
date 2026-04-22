// test-lane: adversarial

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { afterEach, describe, expect, test, vi } from "vitest";
import type { AuditLogger } from "../../src/mcp/audit.js";
import { DEFAULT_POLICY, UNRESTRICTED_POLICY } from "../../src/mcp/policy.js";
import { registerCxMcpTool } from "../../src/mcp/tools/register.js";
import type { CxMcpWorkspace } from "../../src/mcp/workspace.js";

type RegisteredHandler = (args: Record<string, unknown>) => Promise<unknown>;

const TEST_TOOL = {
  name: "list",
  capability: "read",
  stability: "STABLE",
} as const;

const TEST_MUTATION_TOOL = {
  name: "replace_repomix_span",
  capability: "mutate",
  stability: "BETA",
} as const;

function createWorkspace(options?: {
  policy?: CxMcpWorkspace["policy"];
  auditLogger?: AuditLogger;
}): CxMcpWorkspace {
  return {
    config: {} as never,
    sourceRoot: ".",
    policy: options?.policy ?? DEFAULT_POLICY,
    ...(options?.auditLogger ? { auditLogger: options.auditLogger } : {}),
    resolveMasterList: async () => [],
  };
}

function createCaptureServer(): {
  server: McpServer;
  getHandler: () => RegisteredHandler;
} {
  let handler: RegisteredHandler | undefined;
  const server = {
    registerTool: (
      _name: string,
      _metadata: unknown,
      registeredHandler: RegisteredHandler,
    ) => {
      handler = registeredHandler;
    },
  } as unknown as McpServer;

  return {
    server,
    getHandler: () => {
      if (!handler) {
        throw new Error("Expected tool handler to be registered.");
      }
      return handler;
    },
  };
}

afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe("registerCxMcpTool runtime hardening", () => {
  test("returns valid text content payloads", async () => {
    const capture = createCaptureServer();
    registerCxMcpTool(
      capture.server,
      createWorkspace(),
      TEST_TOOL,
      {
        title: "List workspace files",
        description: "List files",
        inputSchema: {},
      },
      async () => ({
        content: [{ type: "text", text: "ok\n" }],
      }),
    );

    await expect(capture.getHandler()({})).resolves.toEqual({
      content: [{ type: "text", text: "ok\n" }],
    });
  });

  test("rejects malformed payloads that omit content", async () => {
    const capture = createCaptureServer();
    registerCxMcpTool(
      capture.server,
      createWorkspace(),
      TEST_TOOL,
      {
        title: "List workspace files",
        description: "List files",
        inputSchema: {},
      },
      async () => ({ status: "partial" }) as never,
    );

    await expect(capture.getHandler()({})).rejects.toThrow(
      'returned malformed payload: missing required "content" array',
    );
  });

  test("rejects interrupted text blocks with missing text fields", async () => {
    const capture = createCaptureServer();
    registerCxMcpTool(
      capture.server,
      createWorkspace(),
      TEST_TOOL,
      {
        title: "List workspace files",
        description: "List files",
        inputSchema: {},
      },
      async () =>
        ({
          content: [{ type: "text" }],
        }) as never,
    );

    await expect(capture.getHandler()({})).rejects.toThrow(
      "content[0].text must be a string",
    );
  });

  test("times out long-running tool calls", async () => {
    const capture = createCaptureServer();
    registerCxMcpTool(
      capture.server,
      createWorkspace(),
      TEST_TOOL,
      {
        title: "List workspace files",
        description: "List files",
        inputSchema: {},
      },
      () =>
        new Promise<never>(() => {
          // Intentionally unresolved to simulate a stalled runtime boundary.
        }),
      {
        toolTimeoutMs: 20,
      },
    );

    await expect(capture.getHandler()({})).rejects.toThrow(
      'MCP tool "list" timed out after 20ms',
    );
  });

  test("preserves delayed runtime failures that arrive before timeout", async () => {
    const capture = createCaptureServer();
    registerCxMcpTool(
      capture.server,
      createWorkspace(),
      TEST_TOOL,
      {
        title: "List workspace files",
        description: "List files",
        inputSchema: {},
      },
      () =>
        new Promise((_resolve, reject) => {
          setTimeout(() => reject(new Error("interrupted stream payload")), 20);
        }),
      {
        toolTimeoutMs: 200,
      },
    );

    await expect(capture.getHandler()({})).rejects.toThrow(
      "interrupted stream payload",
    );
  });

  test("short-circuits malformed args when policy denies mutate capability", async () => {
    const capture = createCaptureServer();
    const handler = vi.fn(async () => ({
      content: [{ type: "text", text: "should never run" }],
    }));

    registerCxMcpTool(
      capture.server,
      createWorkspace({
        policy: DEFAULT_POLICY,
      }),
      TEST_MUTATION_TOOL,
      {
        title: "Replace source span",
        description: "Mutate source content",
        inputSchema: {},
      },
      handler,
    );

    await expect(
      capture.getHandler()({
        path: 17,
        startLine: "invalid",
      }),
    ).rejects.toThrow("Access denied");
    expect(handler).not.toHaveBeenCalled();
  });

  test("records allowed audit entries even when runtime fails mid-execution", async () => {
    const capture = createCaptureServer();
    const logToolAccess = vi.fn(
      async (
        _tool: string,
        _capability: string,
        _allowed: boolean,
        _reason: string,
      ) => {},
    );
    const auditLogger = { logToolAccess } as unknown as AuditLogger;

    registerCxMcpTool(
      capture.server,
      createWorkspace({
        policy: UNRESTRICTED_POLICY,
        auditLogger,
      }),
      TEST_MUTATION_TOOL,
      {
        title: "Replace source span",
        description: "Mutate source content",
        inputSchema: {},
      },
      async () => {
        throw new Error("tool handler interrupted after partial output");
      },
    );

    await expect(
      capture.getHandler()({
        path: "src/index.ts",
        startLine: 1,
        endLine: 1,
        replacement: "export const value = 2;",
      }),
    ).rejects.toThrow("tool handler interrupted after partial output");

    expect(logToolAccess).toHaveBeenCalledTimes(1);
    expect(logToolAccess.mock.calls[0]?.[0]).toBe("replace_repomix_span");
    expect(logToolAccess.mock.calls[0]?.[1]).toBe("mutate");
    expect(logToolAccess.mock.calls[0]?.[2]).toBe(true);
    expect(typeof logToolAccess.mock.calls[0]?.[3]).toBe("string");
  });

  test("times out interrupted mutation tools with single audit decision logging", async () => {
    const capture = createCaptureServer();
    const logToolAccess = vi.fn(
      async (
        _tool: string,
        _capability: string,
        _allowed: boolean,
        _reason: string,
      ) => {},
    );
    const auditLogger = { logToolAccess } as unknown as AuditLogger;

    registerCxMcpTool(
      capture.server,
      createWorkspace({
        policy: UNRESTRICTED_POLICY,
        auditLogger,
      }),
      TEST_MUTATION_TOOL,
      {
        title: "Replace source span",
        description: "Mutate source content",
        inputSchema: {},
      },
      () =>
        new Promise<never>(() => {
          // Intentionally unresolved to simulate an interrupted runtime.
        }),
      {
        toolTimeoutMs: 20,
      },
    );

    await expect(
      capture.getHandler()({
        path: "src/index.ts",
        startLine: 1,
        endLine: 1,
        replacement: "export const value = 3;",
      }),
    ).rejects.toThrow('MCP tool "replace_repomix_span" timed out after 20ms');

    expect(logToolAccess).toHaveBeenCalledTimes(1);
    expect(logToolAccess.mock.calls[0]?.[0]).toBe("replace_repomix_span");
    expect(logToolAccess.mock.calls[0]?.[2]).toBe(true);
  });
});
