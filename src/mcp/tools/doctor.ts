import path from "node:path";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { collectDoctorMcpReport } from "../../doctor/mcp.js";
import { collectDoctorOverlapsReport } from "../../doctor/overlaps.js";
import { collectDoctorSecretsReport } from "../../doctor/secrets.js";
import { recommendWorkflow } from "../../doctor/workflow.js";
import { withPolicyEnforcement } from "../enforce.js";
import type { CxMcpWorkspace } from "../workspace.js";
import { jsonToolResult } from "./utils.js";

export function registerDoctorTools(
  server: McpServer,
  workspace: CxMcpWorkspace,
): void {
  const doctorMcpHandler = withPolicyEnforcement(
    "doctor_mcp",
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
    "doctor_mcp",
    {
      title: "Diagnose MCP profile",
      description:
        "Inspect the resolved MCP profile and inherited file scopes from the live workspace configuration.",
      inputSchema: z.object({}),
    },
    doctorMcpHandler,
  );

  const doctorWorkflowHandler = withPolicyEnforcement(
    "doctor_workflow",
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
    "doctor_workflow",
    {
      title: "Recommend workflow",
      description:
        "Recommend whether a task should use inspect, bundle preview, or MCP, including mixed-task sequences.",
      inputSchema: z.object({
        task: z.string().min(1),
      }),
    },
    doctorWorkflowHandler,
  );

  const doctorOverlapsHandler = withPolicyEnforcement(
    "doctor_overlaps",
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
    "doctor_overlaps",
    {
      title: "Diagnose section overlaps",
      description:
        "Inspect live workspace section ownership and duplicate file assignments.",
      inputSchema: z.object({}),
    },
    doctorOverlapsHandler,
  );

  const doctorSecretsHandler = withPolicyEnforcement(
    "doctor_secrets",
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
    "doctor_secrets",
    {
      title: "Diagnose secret hygiene",
      description:
        "Scan the live workspace file scope for suspicious secrets before a patch is written.",
      inputSchema: z.object({}),
    },
    doctorSecretsHandler,
  );
}
