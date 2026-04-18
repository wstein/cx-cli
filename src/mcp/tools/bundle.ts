import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { collectInspectReport } from "../../inspect/report.js";
import { withPolicyEnforcement } from "../enforce.js";
import { tierLabel } from "../tiers.js";
import type { CxMcpWorkspace } from "../workspace.js";
import type { CxMcpToolDefinition } from "./catalog.js";
import { jsonToolResult } from "./utils.js";

const INSPECT_TOOL = {
  name: "inspect",
  capability: "plan",
} as const satisfies CxMcpToolDefinition;
const BUNDLE_TOOL = {
  name: "bundle",
  capability: "plan",
} as const satisfies CxMcpToolDefinition;

export const BUNDLE_TOOL_DEFINITIONS = [
  INSPECT_TOOL,
  BUNDLE_TOOL,
] as const satisfies readonly CxMcpToolDefinition[];

export function registerBundleTools(
  server: McpServer,
  workspace: CxMcpWorkspace,
): void {
  const inspectHandler = withPolicyEnforcement(
    INSPECT_TOOL.name,
    async (args: Record<string, unknown>) => {
      const report = await collectInspectReport({
        config: workspace.config,
        ...(args.tokenBreakdown !== undefined
          ? { tokenBreakdown: args.tokenBreakdown as boolean }
          : {}),
      });

      return jsonToolResult({
        command: "inspect",
        ...report,
      });
    },
    workspace.policy,
    workspace.auditLogger,
  );

  server.registerTool(
    INSPECT_TOOL.name,
    {
      title: "Inspect live bundle plan",
      description: `${tierLabel("inspect")} Inspect the bundle plan derived from the live workspace files without reading bundle artifacts.`,
      inputSchema: z.object({
        tokenBreakdown: z.boolean().optional(),
      }),
    },
    inspectHandler,
  );

  const bundleHandler = withPolicyEnforcement(
    BUNDLE_TOOL.name,
    async (args: Record<string, unknown>) => {
      const report = await collectInspectReport({
        config: workspace.config,
        ...(args.tokenBreakdown !== undefined
          ? { tokenBreakdown: args.tokenBreakdown as boolean }
          : {}),
      });

      return jsonToolResult({
        command: "bundle preview",
        projectName: report.summary.projectName,
        sourceRoot: report.summary.sourceRoot,
        bundleDir: report.summary.bundleDir,
        sectionCount: report.summary.sectionCount,
        assetCount: report.summary.assetCount,
        unmatchedCount: report.summary.unmatchedCount,
        tokenBreakdown: report.tokenBreakdown ?? null,
        warnings: report.warnings,
        note: "Use cx bundle locally to write the artifact; this MCP preview stays on the live workspace.",
      });
    },
    workspace.policy,
    workspace.auditLogger,
  );

  server.registerTool(
    BUNDLE_TOOL.name,
    {
      title: "Preview bundle snapshot",
      description: `${tierLabel("bundle")} Preview the current bundle snapshot from live workspace files. This tool does not read bundle artifacts for reasoning.`,
      inputSchema: z.object({
        tokenBreakdown: z.boolean().optional(),
      }),
    },
    bundleHandler,
  );
}
