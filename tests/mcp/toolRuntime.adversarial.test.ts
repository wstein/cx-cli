// test-lane: adversarial
import { afterEach, describe, expect, mock, test } from "bun:test";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { DEFAULT_POLICY } from "../../src/mcp/policy.js";
import { registerCxMcpTool } from "../../src/mcp/tools/register.js";
import type { CxMcpWorkspace } from "../../src/mcp/workspace.js";

type RegisteredHandler = (args: Record<string, unknown>) => Promise<unknown>;

const TEST_TOOL = {
  name: "list",
  capability: "read",
} as const;

function createWorkspace(): CxMcpWorkspace {
  return {
    config: {} as never,
    sourceRoot: ".",
    policy: DEFAULT_POLICY,
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
  mock.restore();
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
});
