import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { collectMcpCatalogReport } from "../../adapter/cliParity.js";
import { tierLabel } from "../tiers.js";
import type { CxMcpWorkspace } from "../workspace.js";
import type { CxMcpToolDefinition } from "./catalog.js";
import { registerCxMcpTool } from "./register.js";
import { jsonToolResult } from "./utils.js";

const MCP_CATALOG_TOOL = {
  name: "mcp_catalog",
  capability: "observe",
  stability: "STABLE",
} as const satisfies CxMcpToolDefinition;

export const META_TOOL_DEFINITIONS = [
  MCP_CATALOG_TOOL,
] as const satisfies readonly CxMcpToolDefinition[];

export function registerMetaTools(
  server: McpServer,
  workspace: CxMcpWorkspace,
): void {
  registerCxMcpTool(
    server,
    workspace,
    MCP_CATALOG_TOOL,
    {
      title: "Inspect MCP catalog",
      description: `${tierLabel(MCP_CATALOG_TOOL.stability)} Return the machine-readable MCP tool catalog for the active cx process.`,
      inputSchema: z.object({}),
    },
    async () =>
      jsonToolResult({
        ...collectMcpCatalogReport(),
        sourceRoot: workspace.sourceRoot,
      }),
  );
}
