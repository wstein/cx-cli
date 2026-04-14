import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { collectInspectReport } from "../../inspect/report.js";
import type { CxMcpWorkspace } from "../workspace.js";
import { jsonToolResult } from "./utils.js";

export function registerBundleTools(
  server: McpServer,
  workspace: CxMcpWorkspace,
): void {
  server.registerTool(
    "inspect",
    {
      title: "Inspect live bundle plan",
      description:
        "Inspect the bundle plan derived from the live workspace files without reading bundle artifacts.",
      inputSchema: z.object({
        tokenBreakdown: z.boolean().optional(),
      }),
    },
    async (args) => {
      const report = await collectInspectReport({
        config: workspace.config,
        ...(args.tokenBreakdown !== undefined
          ? { tokenBreakdown: args.tokenBreakdown }
          : {}),
      });

      return jsonToolResult({
        command: "inspect",
        ...report,
      });
    },
  );

  server.registerTool(
    "bundle",
    {
      title: "Preview bundle snapshot",
      description:
        "Preview the current bundle snapshot from live workspace files. This tool does not read bundle artifacts for reasoning.",
      inputSchema: z.object({
        tokenBreakdown: z.boolean().optional(),
      }),
    },
    async (args) => {
      const report = await collectInspectReport({
        config: workspace.config,
        ...(args.tokenBreakdown !== undefined
          ? { tokenBreakdown: args.tokenBreakdown }
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
        note:
          "Use cx bundle locally to write the artifact; this MCP preview stays on the live workspace.",
      });
    },
  );
}
