import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { CX_VERSION } from "../repomix/render.js";

export interface CxMcpServerOptions {
  configPath: string;
}

export interface CxMcpServerDeps {
  processExit?: (code: number) => void;
}

function buildInstructions(configPath: string): string {
  return [
    "cx mcp provides deterministic, manifest-bound agent access to repository context.",
    "Use the cx-mcp.toml profile when present; fall back to cx.toml when the MCP profile is absent.",
    `Active profile: ${configPath}`,
    "Tool registrations are intentionally scoped to cx-specific workflows.",
  ].join(" ");
}

export function createCxMcpServer(
  options: CxMcpServerOptions,
): McpServer {
  return new McpServer(
    {
      name: "cx-mcp-server",
      version: CX_VERSION,
    },
    {
      instructions: buildInstructions(options.configPath),
    },
  );
}

export async function runCxMcpServer(
  configPath: string,
  deps: CxMcpServerDeps = {},
): Promise<void> {
  const server = createCxMcpServer({ configPath });
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
