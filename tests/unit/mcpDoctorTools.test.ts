// test-lane: unit
import { describe, expect, test } from "bun:test";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import { promisify } from "node:util";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { loadCxConfig } from "../../src/config/load.js";
import { DEFAULT_POLICY } from "../../src/mcp/policy.js";
import { registerDoctorTools } from "../../src/mcp/tools/doctor.js";
import { createCxMcpWorkspace } from "../../src/mcp/workspace.js";
import { buildConfig } from "../helpers/config/buildConfig.js";
import { createWorkspace } from "../helpers/workspace/createWorkspace.js";

const execFileAsync = promisify(execFile);

interface RegisteredTool {
  metadata: {
    title: string;
    description: string;
  };
  handler: (args: Record<string, unknown>) => Promise<{
    content: Array<{ type: "text"; text: string }>;
  }>;
}

function createCaptureServer() {
  const tools = new Map<string, RegisteredTool>();
  const server = {
    registerTool: (
      name: string,
      metadata: RegisteredTool["metadata"],
      handler: RegisteredTool["handler"],
    ) => {
      tools.set(name, { metadata, handler });
    },
  } as unknown as McpServer;

  return { server, tools };
}

function firstText(result: Awaited<ReturnType<RegisteredTool["handler"]>>) {
  return result.content[0]?.text ?? "";
}

function getTool(
  tools: Map<string, RegisteredTool>,
  name: string,
): RegisteredTool {
  const tool = tools.get(name);
  if (!tool) {
    throw new Error(`Missing tool: ${name}`);
  }
  return tool;
}

describe("registerDoctorTools", () => {
  test("registers all doctor MCP tools and executes their handlers", async () => {
    const workspace = await createWorkspace({
      config: buildConfig({
        projectName: "doctor-tools",
        sections: {
          src: {
            include: ["src/**"],
            exclude: [],
          },
        },
      }),
      files: {
        "src/index.ts": "export const value = 1;\n",
        "README.md": "# Demo\n",
      },
    });

    try {
      await execFileAsync("git", ["init", "-q"], { cwd: workspace.rootDir });
      await execFileAsync("git", ["config", "user.email", "cx@example.com"], {
        cwd: workspace.rootDir,
      });
      await execFileAsync("git", ["config", "user.name", "cx"], {
        cwd: workspace.rootDir,
      });
      await execFileAsync("git", ["add", "."], { cwd: workspace.rootDir });
      await execFileAsync("git", ["commit", "-q", "-m", "init"], {
        cwd: workspace.rootDir,
      });

      const config = await loadCxConfig(workspace.configPath);
      const { server, tools } = createCaptureServer();
      registerDoctorTools(
        server,
        createCxMcpWorkspace(config, { policy: DEFAULT_POLICY }),
      );

      expect([...tools.keys()].sort()).toEqual([
        "doctor_mcp",
        "doctor_overlaps",
        "doctor_secrets",
        "doctor_workflow",
      ]);
      expect(getTool(tools, "doctor_mcp").metadata.description).toContain(
        "BETA",
      );

      const mcpPayload = JSON.parse(
        firstText(await getTool(tools, "doctor_mcp").handler({})),
      ) as Record<string, unknown>;
      const overlapsPayload = JSON.parse(
        firstText(await getTool(tools, "doctor_overlaps").handler({})),
      ) as Record<string, unknown>;
      const secretsPayload = JSON.parse(
        firstText(await getTool(tools, "doctor_secrets").handler({})),
      ) as Record<string, unknown>;
      const workflowPayload = JSON.parse(
        firstText(
          await getTool(tools, "doctor_workflow").handler({
            task: "bundle proof",
          }),
        ),
      ) as Record<string, unknown>;

      expect(mcpPayload.command).toBe("doctor mcp");
      expect(typeof mcpPayload.auditSummary).toBe("object");
      expect(overlapsPayload.command).toBe("doctor overlaps");
      expect(secretsPayload.command).toBe("doctor secrets");
      expect(workflowPayload.command).toBe("doctor workflow");
      expect(workflowPayload.task).toBe("bundle proof");
    } finally {
      await fs.rm(workspace.rootDir, { recursive: true, force: true });
    }
  });
});
