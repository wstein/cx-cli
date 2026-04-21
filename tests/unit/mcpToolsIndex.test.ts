// test-lane: unit

import fs from "node:fs/promises";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { afterEach, describe, expect, test } from "vitest";

import { loadCxConfig } from "../../src/config/load.js";
import { DEFAULT_POLICY } from "../../src/mcp/policy.js";
import { registerCxMcpTools } from "../../src/mcp/tools/index.js";
import { createCxMcpWorkspace } from "../../src/mcp/workspace.js";
import { buildConfig } from "../helpers/config/buildConfig.js";
import { createWorkspace } from "../helpers/workspace/createWorkspace.js";

interface RegisteredTool {
  metadata: {
    title: string;
    description: string;
  };
}

function createCaptureServer() {
  const tools = new Map<string, RegisteredTool>();
  const server = {
    registerTool: (
      name: string,
      metadata: RegisteredTool["metadata"],
      _handler: unknown,
    ) => {
      tools.set(name, { metadata });
    },
  } as unknown as McpServer;

  return { server, tools };
}

async function loadQuietCxConfig(configPath: string) {
  return loadCxConfig(configPath, undefined, undefined, {
    emitBehaviorLogs: false,
  });
}

describe("registerCxMcpTools", () => {
  let rootDir: string | undefined;

  afterEach(async () => {
    if (rootDir !== undefined) {
      await fs.rm(rootDir, { recursive: true, force: true });
      rootDir = undefined;
    }
  });

  test("registers tool groups from workspace, bundle, extract, doctor, and notes modules", async () => {
    const workspace = await createWorkspace({
      config: buildConfig({
        projectName: "mcp-tools-index",
        sections: {
          src: {
            include: ["src/**"],
            exclude: [],
          },
        },
      }),
      files: {
        "src/index.ts": "export const value = 1;\n",
      },
    });
    rootDir = workspace.rootDir;

    const config = await loadQuietCxConfig(workspace.configPath);
    const { server, tools } = createCaptureServer();

    registerCxMcpTools(
      server,
      createCxMcpWorkspace(config, { policy: DEFAULT_POLICY }),
    );

    expect(tools.has("list")).toBe(true);
    expect(tools.has("bundle")).toBe(true);
    expect(tools.has("extract")).toBe(true);
    expect(tools.has("doctor_mcp")).toBe(true);
    expect(tools.has("notes_graph")).toBe(true);
  });
});
