import path from "node:path";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  runBundleCommand,
  runListCommand,
  runValidateCommand,
  runVerifyCommand,
} from "../../adapter/cliParity.js";
import { collectInspectReport } from "../../inspect/report.js";
import { CxError } from "../../shared/errors.js";
import { isSubpath } from "../../shared/paths.js";
import { tierLabel } from "../tiers.js";
import type { CxMcpWorkspace } from "../workspace.js";
import type { CxMcpToolDefinition } from "./catalog.js";
import { runJsonCommandPayload } from "./command.js";
import { registerCxMcpTool } from "./register.js";
import { jsonToolResult } from "./utils.js";

const INSPECT_TOOL = {
  name: "inspect",
  capability: "plan",
  stability: "STABLE",
} as const satisfies CxMcpToolDefinition;
const BUNDLE_TOOL = {
  name: "bundle",
  capability: "plan",
  stability: "STABLE",
} as const satisfies CxMcpToolDefinition;
const BUNDLE_CREATE_TOOL = {
  name: "bundle_create",
  capability: "mutate",
  stability: "STABLE",
} as const satisfies CxMcpToolDefinition;
const BUNDLE_LIST_TOOL = {
  name: "bundle_list",
  capability: "read",
  stability: "STABLE",
} as const satisfies CxMcpToolDefinition;
const BUNDLE_VALIDATE_TOOL = {
  name: "bundle_validate",
  capability: "observe",
  stability: "STABLE",
} as const satisfies CxMcpToolDefinition;
const BUNDLE_VERIFY_TOOL = {
  name: "bundle_verify",
  capability: "observe",
  stability: "STABLE",
} as const satisfies CxMcpToolDefinition;

export const BUNDLE_TOOL_DEFINITIONS = [
  INSPECT_TOOL,
  BUNDLE_TOOL,
  BUNDLE_CREATE_TOOL,
  BUNDLE_LIST_TOOL,
  BUNDLE_VALIDATE_TOOL,
  BUNDLE_VERIFY_TOOL,
] as const satisfies readonly CxMcpToolDefinition[];

function resolveWorkspaceScopedPath(
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

export function registerBundleTools(
  server: McpServer,
  workspace: CxMcpWorkspace,
): void {
  registerCxMcpTool(
    server,
    workspace,
    INSPECT_TOOL,
    {
      title: "Inspect live bundle plan",
      description: `${tierLabel(INSPECT_TOOL.stability)} Inspect the bundle plan derived from the live workspace files without reading bundle artifacts.`,
      inputSchema: z.object({
        tokenBreakdown: z.boolean().optional(),
      }),
    },
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
  );

  registerCxMcpTool(
    server,
    workspace,
    BUNDLE_TOOL,
    {
      title: "Preview bundle snapshot",
      description: `${tierLabel(BUNDLE_TOOL.stability)} Preview the current bundle snapshot from live workspace files. This tool does not read bundle artifacts for reasoning.`,
      inputSchema: z.object({
        tokenBreakdown: z.boolean().optional(),
      }),
    },
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
  );

  registerCxMcpTool(
    server,
    workspace,
    BUNDLE_CREATE_TOOL,
    {
      title: "Create bundle",
      description: `${tierLabel(BUNDLE_CREATE_TOOL.stability)} Run cx bundle to write an immutable bundle artifact for the active workspace.`,
      inputSchema: z.object({
        force: z.boolean().optional(),
        ci: z.boolean().optional(),
        update: z.boolean().optional(),
        includeDocExports: z.boolean().optional(),
        docsRootLevel: z.union([z.literal(0), z.literal(1)]).optional(),
      }),
    },
    async (args: Record<string, unknown>) =>
      jsonToolResult(
        await runJsonCommandPayload(workspace.sourceRoot, (io) =>
          runBundleCommand(
            {
              config: path.join(workspace.sourceRoot, "cx.toml"),
              json: true,
              force: args.force as boolean | undefined,
              ci: args.ci as boolean | undefined,
              update: args.update as boolean | undefined,
              includeDocExports: args.includeDocExports as boolean | undefined,
              ...(typeof args.docsRootLevel === "number" &&
                (args.docsRootLevel === 0 || args.docsRootLevel === 1) && {
                  docsRootLevel: args.docsRootLevel,
                }),
            },
            io,
          ),
        ),
      ),
  );

  registerCxMcpTool(
    server,
    workspace,
    BUNDLE_LIST_TOOL,
    {
      title: "List bundle contents",
      description: `${tierLabel(BUNDLE_LIST_TOOL.stability)} Run cx list against a bundle directory and return manifest rows.`,
      inputSchema: z.object({
        bundleDir: z.string().min(1),
        sections: z.array(z.string().min(1)).optional(),
        files: z.array(z.string().min(1)).optional(),
        derivedReviewExportsOnly: z.boolean().optional(),
      }),
    },
    async (args: Record<string, unknown>) => {
      const bundleDir = resolveWorkspaceScopedPath(
        workspace,
        args.bundleDir as string,
        "bundleDir",
      );
      return jsonToolResult(
        await runJsonCommandPayload(workspace.sourceRoot, (io) =>
          runListCommand(
            {
              bundleDir,
              json: true,
              sections: args.sections as string[] | undefined,
              files: args.files as string[] | undefined,
              derivedReviewExportsOnly: args.derivedReviewExportsOnly as
                | boolean
                | undefined,
            },
            io,
          ),
        ),
      );
    },
  );

  registerCxMcpTool(
    server,
    workspace,
    BUNDLE_VALIDATE_TOOL,
    {
      title: "Validate bundle",
      description: `${tierLabel(BUNDLE_VALIDATE_TOOL.stability)} Run cx validate against a bundle directory.`,
      inputSchema: z.object({
        bundleDir: z.string().min(1),
      }),
    },
    async (args: Record<string, unknown>) => {
      const bundleDir = resolveWorkspaceScopedPath(
        workspace,
        args.bundleDir as string,
        "bundleDir",
      );
      return jsonToolResult(
        await runJsonCommandPayload(workspace.sourceRoot, (io) =>
          runValidateCommand({ bundleDir, json: true }, io),
        ),
      );
    },
  );

  registerCxMcpTool(
    server,
    workspace,
    BUNDLE_VERIFY_TOOL,
    {
      title: "Verify bundle",
      description: `${tierLabel(BUNDLE_VERIFY_TOOL.stability)} Run cx verify against a bundle directory, optionally comparing selected files or sections.`,
      inputSchema: z.object({
        bundleDir: z.string().min(1),
        sections: z.array(z.string().min(1)).optional(),
        files: z.array(z.string().min(1)).optional(),
        againstDir: z.string().min(1).optional(),
      }),
    },
    async (args: Record<string, unknown>) => {
      const bundleDir = resolveWorkspaceScopedPath(
        workspace,
        args.bundleDir as string,
        "bundleDir",
      );
      const againstDir =
        typeof args.againstDir === "string"
          ? resolveWorkspaceScopedPath(workspace, args.againstDir, "againstDir")
          : undefined;
      return jsonToolResult(
        await runJsonCommandPayload(workspace.sourceRoot, (io) =>
          runVerifyCommand(
            {
              bundleDir,
              json: true,
              sections: args.sections as string[] | undefined,
              files: args.files as string[] | undefined,
              ...(againstDir !== undefined && { againstDir }),
              config: path.join(workspace.sourceRoot, "cx.toml"),
            },
            io,
          ),
        ),
      );
    },
  );
}
