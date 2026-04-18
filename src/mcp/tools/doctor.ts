import path from "node:path";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { collectDoctorMcpReport } from "../../doctor/mcp.js";
import { collectDoctorOverlapsReport } from "../../doctor/overlaps.js";
import { collectDoctorSecretsReport } from "../../doctor/secrets.js";
import { recommendWorkflow } from "../../doctor/workflow.js";
import { withPolicyEnforcement } from "../enforce.js";
import { tierLabel } from "../tiers.js";
import type { CxMcpWorkspace } from "../workspace.js";
import type { CxMcpToolDefinition } from "./catalog.js";
import { jsonToolResult } from "./utils.js";

const DOCTOR_MCP_TOOL = {
  name: "doctor_mcp",
  capability: "observe",
} as const satisfies CxMcpToolDefinition;
const DOCTOR_WORKFLOW_TOOL = {
  name: "doctor_workflow",
  capability: "observe",
} as const satisfies CxMcpToolDefinition;
const DOCTOR_OVERLAPS_TOOL = {
  name: "doctor_overlaps",
  capability: "observe",
} as const satisfies CxMcpToolDefinition;
const DOCTOR_SECRETS_TOOL = {
  name: "doctor_secrets",
  capability: "observe",
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
  const doctorMcpHandler = withPolicyEnforcement(
    DOCTOR_MCP_TOOL.name,
    async () => {
      const report = await collectDoctorMcpReport({
        config: path.join(workspace.sourceRoot, "cx.toml"),
      });

      return jsonToolResult({
        command: "doctor mcp",
        ...report,
      });
    },
    workspace.policy,
    workspace.auditLogger,
  );

  server.registerTool(
    DOCTOR_MCP_TOOL.name,
    {
      title: "Diagnose MCP profile",
      description: `${tierLabel("doctor_mcp")} Inspect the resolved MCP profile and inherited file scopes from the live workspace configuration.`,
      inputSchema: z.object({}),
    },
    doctorMcpHandler,
  );

  const doctorWorkflowHandler = withPolicyEnforcement(
    DOCTOR_WORKFLOW_TOOL.name,
    async (args: Record<string, unknown>) => {
      const recommendation = recommendWorkflow(args.task as string);

      return jsonToolResult({
        command: "doctor workflow",
        task: args.task,
        ...recommendation,
      });
    },
    workspace.policy,
    workspace.auditLogger,
  );

  server.registerTool(
    DOCTOR_WORKFLOW_TOOL.name,
    {
      title: "Recommend workflow",
      description: `${tierLabel("doctor_workflow")} Recommend whether a task should use inspect, bundle preview, or MCP, including mixed-task sequences.`,
      inputSchema: z.object({
        task: z.string().min(1),
      }),
    },
    doctorWorkflowHandler,
  );

  const doctorOverlapsHandler = withPolicyEnforcement(
    DOCTOR_OVERLAPS_TOOL.name,
    async () => {
      const report = await collectDoctorOverlapsReport({
        config: path.join(workspace.sourceRoot, "cx.toml"),
      });

      return jsonToolResult({
        command: "doctor overlaps",
        ...report,
      });
    },
    workspace.policy,
    workspace.auditLogger,
  );

  server.registerTool(
    DOCTOR_OVERLAPS_TOOL.name,
    {
      title: "Diagnose section overlaps",
      description: `${tierLabel("doctor_overlaps")} Inspect live workspace section ownership and duplicate file assignments.`,
      inputSchema: z.object({}),
    },
    doctorOverlapsHandler,
  );

  const doctorSecretsHandler = withPolicyEnforcement(
    DOCTOR_SECRETS_TOOL.name,
    async () => {
      const report = await collectDoctorSecretsReport({
        config: path.join(workspace.sourceRoot, "cx.toml"),
      });

      return jsonToolResult({
        command: "doctor secrets",
        ...report,
      });
    },
    workspace.policy,
    workspace.auditLogger,
  );

  server.registerTool(
    DOCTOR_SECRETS_TOOL.name,
    {
      title: "Diagnose secret hygiene",
      description: `${tierLabel("doctor_secrets")} Scan the live workspace file scope for suspicious secrets before a patch is written.`,
      inputSchema: z.object({}),
    },
    doctorSecretsHandler,
  );
}
