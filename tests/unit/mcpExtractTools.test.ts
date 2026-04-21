// test-lane: unit

import fs from "node:fs/promises";
import path from "node:path";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { afterEach, describe, expect, test } from "vitest";

import { loadCxConfig } from "../../src/config/load.js";
import { UNRESTRICTED_POLICY } from "../../src/mcp/policy.js";
import { registerExtractTools } from "../../src/mcp/tools/extract.js";
import { createCxMcpWorkspace } from "../../src/mcp/workspace.js";
import {
  createProject,
  runQuietBundleCommand,
  tamperSectionOutput,
} from "../bundle/helpers.js";

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

async function loadQuietCxConfig(configPath: string) {
  return loadCxConfig(configPath, undefined, undefined, {
    emitBehaviorLogs: false,
  });
}

describe("registerExtractTools", () => {
  const roots = new Set<string>();

  afterEach(async () => {
    await Promise.all(
      [...roots].map(async (root) => {
        await fs.rm(root, { recursive: true, force: true });
      }),
    );
    roots.clear();
  });

  test("restores bundle content through MCP inside the workspace boundary", async () => {
    const project = await createProject({ initializeGit: true });
    roots.add(project.root);

    expect(await runQuietBundleCommand({ config: project.configPath })).toBe(0);

    const config = await loadQuietCxConfig(project.configPath);
    const { server, tools } = createCaptureServer();
    registerExtractTools(
      server,
      createCxMcpWorkspace(config, { policy: UNRESTRICTED_POLICY }),
    );

    const result = await getTool(tools, "extract").handler({
      bundleDir: path.relative(project.root, project.bundleDir),
      destinationDir: "restored",
      verify: true,
      overwrite: false,
    });
    const payload = JSON.parse(firstText(result)) as {
      command: string;
      valid: boolean;
      extractedFiles?: string[];
    };

    expect(payload.command).toBe("extract");
    expect(payload.valid).toBe(true);
    expect(payload.extractedFiles).toContain("src/index.ts");
    await expect(
      fs.readFile(path.join(project.root, "restored", "src/index.ts"), "utf8"),
    ).resolves.toContain('export const demo = "================";');
  });

  test("returns a structured extractability failure payload when bundle output drifts", async () => {
    const project = await createProject({ initializeGit: true });
    roots.add(project.root);

    expect(await runQuietBundleCommand({ config: project.configPath })).toBe(0);
    await tamperSectionOutput(
      project.bundleDir,
      "src",
      'export const demo = "================";',
      'export const demo = "drifted";',
    );

    const config = await loadQuietCxConfig(project.configPath);
    const { server, tools } = createCaptureServer();
    registerExtractTools(
      server,
      createCxMcpWorkspace(config, { policy: UNRESTRICTED_POLICY }),
    );

    const result = await getTool(tools, "extract").handler({
      bundleDir: path.relative(project.root, project.bundleDir),
      destinationDir: "restored",
      verify: true,
    });
    const payload = JSON.parse(firstText(result)) as {
      command: string;
      valid: boolean;
      error?: {
        type?: string;
        files?: Array<{ path?: string; status?: string }>;
      };
    };

    expect(payload.command).toBe("extract");
    expect(payload.valid).toBe(false);
    expect(payload.error?.type).toBe("extractability_mismatch");
    expect(payload.error?.files?.[0]?.path).toBe("src/index.ts");
    expect(payload.error?.files?.[0]?.status).toBe("degraded");
  });

  test("rejects bundle paths that escape the workspace boundary", async () => {
    const project = await createProject({ initializeGit: true });
    roots.add(project.root);

    const config = await loadQuietCxConfig(project.configPath);
    const { server, tools } = createCaptureServer();
    registerExtractTools(
      server,
      createCxMcpWorkspace(config, { policy: UNRESTRICTED_POLICY }),
    );

    await expect(
      getTool(tools, "extract").handler({
        bundleDir: "../outside",
        destinationDir: "restored",
      }),
    ).rejects.toThrow(
      "bundleDir must stay within the active workspace boundary",
    );
  });
});
