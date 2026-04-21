import path from "node:path";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { collectExtractJsonReport } from "../../extract/report.js";
import { CxError } from "../../shared/errors.js";
import { isSubpath } from "../../shared/paths.js";
import { tierLabel } from "../tiers.js";
import type { CxMcpWorkspace } from "../workspace.js";
import type { CxMcpToolDefinition } from "./catalog.js";
import { registerCxMcpTool } from "./register.js";
import { jsonToolResult } from "./utils.js";

const EXTRACT_TOOL = {
  name: "extract",
  capability: "mutate",
  stability: "STABLE",
} as const satisfies CxMcpToolDefinition;

export const EXTRACT_TOOL_DEFINITIONS = [
  EXTRACT_TOOL,
] as const satisfies readonly CxMcpToolDefinition[];

function resolveWorkspaceScopedDirectory(
  workspace: CxMcpWorkspace,
  candidatePath: string,
  fieldName: string,
): string {
  const resolvedPath = path.resolve(workspace.sourceRoot, candidatePath);
  if (
    resolvedPath !== workspace.sourceRoot &&
    !isSubpath(workspace.sourceRoot, resolvedPath)
  ) {
    throw new CxError(
      `${fieldName} must stay within the active workspace boundary.`,
      2,
    );
  }

  return resolvedPath;
}

export function registerExtractTools(
  server: McpServer,
  workspace: CxMcpWorkspace,
): void {
  registerCxMcpTool(
    server,
    workspace,
    EXTRACT_TOOL,
    {
      title: "Extract bundle contents",
      description: `${tierLabel(EXTRACT_TOOL.stability)} Restore files from an existing bundle into the live workspace boundary using the same deterministic safety checks as cx extract.`,
      inputSchema: z.object({
        bundleDir: z.string().min(1),
        destinationDir: z.string().min(1).optional(),
        sections: z.array(z.string().min(1)).optional(),
        files: z.array(z.string().min(1)).optional(),
        assetsOnly: z.boolean().optional(),
        allowDegraded: z.boolean().optional(),
        overwrite: z.boolean().optional(),
        verify: z.boolean().optional(),
      }),
    },
    async (args: Record<string, unknown>) => {
      const bundleDir = resolveWorkspaceScopedDirectory(
        workspace,
        args.bundleDir as string,
        "bundleDir",
      );
      const destinationDir = resolveWorkspaceScopedDirectory(
        workspace,
        (args.destinationDir as string | undefined) ?? ".",
        "destinationDir",
      );
      const report = await collectExtractJsonReport({
        bundleDir,
        destinationDir,
        sections: args.sections as string[] | undefined,
        files: args.files as string[] | undefined,
        assetsOnly: (args.assetsOnly as boolean | undefined) ?? false,
        allowDegraded: args.allowDegraded as boolean | undefined,
        overwrite: (args.overwrite as boolean | undefined) ?? false,
        verify: (args.verify as boolean | undefined) ?? true,
      });

      return jsonToolResult({
        command: "extract",
        ...report.payload,
      });
    },
  );
}
