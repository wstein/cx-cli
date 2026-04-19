import path from "node:path";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { collectDoctorMcpReport } from "../../doctor/mcp.js";
import { collectDoctorOverlapsReport } from "../../doctor/overlaps.js";
import { collectDoctorSecretsReport } from "../../doctor/secrets.js";
import { recommendWorkflow } from "../../doctor/workflow.js";
import { tierLabel } from "../tiers.js";
import type { CxMcpWorkspace } from "../workspace.js";
import type { CxMcpToolDefinition } from "./catalog.js";
import { registerCxMcpTool } from "./register.js";
import { jsonToolResult } from "./utils.js";

const DOCTOR_MCP_TOOL = {
  name: "doctor_mcp",
  capability: "observe",
  stability: "BETA",
} as const satisfies CxMcpToolDefinition;
const DOCTOR_WORKFLOW_TOOL = {
  name: "doctor_workflow",
  capability: "observe",
  stability: "BETA",
} as const satisfies CxMcpToolDefinition;
const DOCTOR_OVERLAPS_TOOL = {
  name: "doctor_overlaps",
  capability: "observe",
  stability: "BETA",
} as const satisfies CxMcpToolDefinition;
const DOCTOR_SECRETS_TOOL = {
  name: "doctor_secrets",
  capability: "observe",
  stability: "BETA",
} as const satisfies CxMcpToolDefinition;

export const DOCTOR_TOOL_DEFINITIONS = [
  DOCTOR_MCP_TOOL,
  DOCTOR_WORKFLOW_TOOL,
  DOCTOR_OVERLAPS_TOOL,
  DOCTOR_SECRETS_TOOL,
] as const satisfies readonly CxMcpToolDefinition[];

export function registerDoctorTools(
  server: McpServer,
  workspace: CxMcpWorkspace,
): void {
  registerCxMcpTool(
    server,
    workspace,
    DOCTOR_MCP_TOOL,
    {
      title: "Diagnose MCP profile",
      description: `${tierLabel(DOCTOR_MCP_TOOL.stability)} Inspect the resolved MCP profile and inherited file scopes from the live workspace configuration.`,
      inputSchema: z.object({}),
    },
    async () => {
      const report = await collectDoctorMcpReport({
        config: path.join(workspace.sourceRoot, "cx.toml"),
      });

      return jsonToolResult({
        command: "doctor mcp",
        ...report,
      });
    },
  );

  registerCxMcpTool(
    server,
    workspace,
    DOCTOR_WORKFLOW_TOOL,
    {
      title: "Recommend workflow",
      description: `${tierLabel(DOCTOR_WORKFLOW_TOOL.stability)} Recommend whether a task should use inspect, bundle preview, or MCP, including mixed-task sequences.`,
      inputSchema: z.object({
        task: z.string().min(1),
      }),
    },
    async (args: Record<string, unknown>) => {
      const recommendation = recommendWorkflow(args.task as string);

      return jsonToolResult({
        command: "doctor workflow",
        task: args.task,
        ...recommendation,
      });
    },
  );

  registerCxMcpTool(
    server,
    workspace,
    DOCTOR_OVERLAPS_TOOL,
    {
      title: "Diagnose section overlaps",
      description: `${tierLabel(DOCTOR_OVERLAPS_TOOL.stability)} Inspect live workspace section ownership and duplicate file assignments.`,
      inputSchema: z.object({}),
    },
    async () => {
      const report = await collectDoctorOverlapsReport({
        config: path.join(workspace.sourceRoot, "cx.toml"),
      });

      return jsonToolResult({
        command: "doctor overlaps",
        ...report,
      });
    },
  );

  registerCxMcpTool(
    server,
    workspace,
    DOCTOR_SECRETS_TOOL,
    {
      title: "Diagnose secret hygiene",
      description: `${tierLabel(DOCTOR_SECRETS_TOOL.stability)} Scan the live workspace file scope for suspicious secrets before a patch is written.`,
      inputSchema: z.object({}),
    },
    async () => {
      const report = await collectDoctorSecretsReport({
        config: path.join(workspace.sourceRoot, "cx.toml"),
      });

      return jsonToolResult({
        command: "doctor secrets",
        ...report,
      });
    },
  );
}
