import path from "node:path";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { runConfigCommand } from "../../adapter/cliParity.js";
import { tierLabel } from "../tiers.js";
import type { CxMcpWorkspace } from "../workspace.js";
import type { CxMcpToolDefinition } from "./catalog.js";
import { runJsonCommandPayload } from "./command.js";
import { registerCxMcpTool } from "./register.js";
import { jsonToolResult } from "./utils.js";

const CONFIG_SHOW_EFFECTIVE_TOOL = {
  name: "config_show_effective",
  capability: "observe",
  stability: "STABLE",
} as const satisfies CxMcpToolDefinition;

export const CONFIG_TOOL_DEFINITIONS = [
  CONFIG_SHOW_EFFECTIVE_TOOL,
] as const satisfies readonly CxMcpToolDefinition[];

export function registerConfigTools(
  server: McpServer,
  workspace: CxMcpWorkspace,
): void {
  registerCxMcpTool(
    server,
    workspace,
    CONFIG_SHOW_EFFECTIVE_TOOL,
    {
      title: "Show effective config",
      description: `${tierLabel(CONFIG_SHOW_EFFECTIVE_TOOL.stability)} Run cx config show-effective and return resolved behavioral settings.`,
      inputSchema: z.object({}),
    },
    async () =>
      jsonToolResult(
        await runJsonCommandPayload(workspace.sourceRoot, (io) =>
          runConfigCommand(
            {
              config: path.join(workspace.sourceRoot, "cx.toml"),
              json: true,
            },
            io,
          ),
        ),
      ),
  );
}
