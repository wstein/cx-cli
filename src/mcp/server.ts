import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import type { CxConfig } from "../config/types.js";
import { CX_VERSION } from "../shared/version.js";
import { registerCxMcpTools } from "./tools/index.js";
import { createCxMcpWorkspace } from "./workspace.js";

export interface CxMcpServerOptions {
  configPath: string;
  config: CxConfig;
}

export interface CxMcpServerDeps {
  processExit?: (code: number) => void;
}

function buildInstructions(configPath: string): string {
  const toolReference = `
Tool reference:
Workspace: list (enumerate tracked files), grep (search file contents), read (fetch a file), replace_repomix_span (patch a span in a section output).
Planning: inspect (live bundle plan without writing artifacts), bundle (preview snapshot metadata).
Doctor: doctor_mcp (diagnose MCP profile), doctor_workflow (recommend inspect/bundle/mcp for a task), doctor_overlaps (find section file conflicts), doctor_secrets (scan for exposed secrets).
Notes: notes_new, notes_read, notes_update, notes_rename, notes_delete (note lifecycle); notes_search, notes_list (discovery); notes_backlinks, notes_orphans, notes_code_links, notes_links (graph queries).`;

  return [
    "cx mcp provides deterministic, file-based agent access to live repository context.",
    "Use cx inspect and the MCP live tools for planning against the workspace filesystem; use cx bundle locally for immutable snapshots and verification, not as a reasoning source inside MCP.",
    "Use cx mcp for interactive exploration, note maintenance, and live workspace changes.",
    "Use the cx-mcp.toml profile when present; fall back to cx.toml when the MCP profile is absent.",
    `Active profile: ${configPath}`,
    toolReference,
  ].join("\n");
}

export function createCxMcpServer(options: CxMcpServerOptions): McpServer {
  const workspace = createCxMcpWorkspace(options.config);
  const server = new McpServer(
    {
      name: "cx-mcp-server",
      version: CX_VERSION,
    },
    {
      instructions: buildInstructions(options.configPath),
    },
  );

  registerCxMcpTools(server, workspace);

  return server;
}

export async function runCxMcpServer(
  configPath: string,
  config: CxConfig,
  deps: CxMcpServerDeps = {},
): Promise<void> {
  const server = createCxMcpServer({ configPath, config });
  const transport = new StdioServerTransport();
  const processExit = deps.processExit ?? process.exit;

  const handleExit = async (): Promise<void> => {
    try {
      await server.close();
      processExit(0);
    } catch {
      processExit(1);
    }
  };

  process.on("SIGINT", handleExit);
  process.on("SIGTERM", handleExit);

  try {
    await server.connect(transport);
  } catch {
    processExit(1);
  }
}
