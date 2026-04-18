import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withPolicyEnforcement } from "../enforce.js";
import type { CxMcpWorkspace } from "../workspace.js";
import type { CxMcpToolDefinition } from "./catalog.js";

export function registerCxMcpTool<TSchema, TResult>(
  server: McpServer,
  workspace: CxMcpWorkspace,
  tool: CxMcpToolDefinition,
  metadata: {
    title: string;
    description: string;
    inputSchema: TSchema;
  },
  handler: (args: Record<string, unknown>) => Promise<TResult>,
): void {
  server.registerTool(
    tool.name,
    metadata as Parameters<McpServer["registerTool"]>[1],
    withPolicyEnforcement(
      tool,
      handler,
      workspace.policy,
      workspace.auditLogger,
    ) as Parameters<McpServer["registerTool"]>[2],
  );
}
