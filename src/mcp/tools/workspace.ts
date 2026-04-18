import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { withPolicyEnforcement } from "../enforce.js";
import { tierLabel } from "../tiers.js";
import type { CxMcpWorkspace } from "../workspace.js";
import {
  grepWorkspaceFiles,
  listWorkspaceFiles,
  readWorkspaceFile,
  replaceWorkspaceSpan,
} from "../workspace.js";
import type { CxMcpToolDefinition } from "./catalog.js";
import { jsonToolResult } from "./utils.js";

const LIST_TOOL = {
  name: "list",
  capability: "read",
} as const satisfies CxMcpToolDefinition;
const GREP_TOOL = {
  name: "grep",
  capability: "read",
} as const satisfies CxMcpToolDefinition;
const READ_TOOL = {
  name: "read",
  capability: "read",
} as const satisfies CxMcpToolDefinition;
const REPLACE_REPOMIX_SPAN_TOOL = {
  name: "replace_repomix_span",
  capability: "mutate",
} as const satisfies CxMcpToolDefinition;

export const WORKSPACE_TOOL_DEFINITIONS = [
  LIST_TOOL,
  GREP_TOOL,
  READ_TOOL,
  REPLACE_REPOMIX_SPAN_TOOL,
] as const satisfies readonly CxMcpToolDefinition[];

export function registerWorkspaceTools(
  server: McpServer,
  workspace: CxMcpWorkspace,
): void {
  const listHandler = withPolicyEnforcement(
    LIST_TOOL.name,
    async (args: Record<string, unknown>) => {
      const files = await listWorkspaceFiles(
        workspace,
        args.prefix as string | undefined,
      );
      return jsonToolResult({
        sourceRoot: workspace.sourceRoot,
        fileCount: files.length,
        files,
      });
    },
    workspace.policy,
    workspace.auditLogger,
  );

  server.registerTool(
    LIST_TOOL.name,
    {
      title: "List workspace files",
      description: `${tierLabel("list")} List files from the cx workspace file scope using the active cx configuration.`,
      inputSchema: z.object({
        prefix: z.string().optional(),
      }),
    },
    listHandler,
  );

  const grepHandler = withPolicyEnforcement(
    GREP_TOOL.name,
    async (args: Record<string, unknown>) => {
      const query = {
        pattern: args.pattern as string,
        ...(args.regex !== undefined ? { regex: args.regex as boolean } : {}),
        ...(args.caseSensitive !== undefined
          ? { caseSensitive: args.caseSensitive as boolean }
          : {}),
        ...(args.prefix !== undefined ? { prefix: args.prefix as string } : {}),
        ...(args.limit !== undefined ? { limit: args.limit as number } : {}),
      };
      const result = await grepWorkspaceFiles(workspace, query);

      return jsonToolResult(result);
    },
    workspace.policy,
    workspace.auditLogger,
  );

  server.registerTool(
    GREP_TOOL.name,
    {
      title: "Search workspace files",
      description: `${tierLabel("grep")} Search files from the cx workspace file scope with a string or regular expression.`,
      inputSchema: z.object({
        pattern: z.string().min(1),
        regex: z.boolean().optional(),
        caseSensitive: z.boolean().optional(),
        prefix: z.string().optional(),
        limit: z.number().int().positive().max(1000).optional(),
      }),
    },
    grepHandler,
  );

  const readHandler = withPolicyEnforcement(
    READ_TOOL.name,
    async (args: Record<string, unknown>) => {
      const query = {
        path: args.path as string,
        ...(args.startLine !== undefined
          ? { startLine: args.startLine as number }
          : {}),
        ...(args.endLine !== undefined
          ? { endLine: args.endLine as number }
          : {}),
      };
      const result = await readWorkspaceFile(workspace, query);

      return jsonToolResult(result);
    },
    workspace.policy,
    workspace.auditLogger,
  );

  server.registerTool(
    READ_TOOL.name,
    {
      title: "Read workspace file",
      description: `${tierLabel("read")} Read a text file from the cx workspace scope with optional line anchors.`,
      inputSchema: z.object({
        path: z.string().min(1),
        startLine: z.number().int().positive().optional(),
        endLine: z.number().int().positive().optional(),
      }),
    },
    readHandler,
  );

  const replaceHandler = withPolicyEnforcement(
    REPLACE_REPOMIX_SPAN_TOOL.name,
    async (args: Record<string, unknown>) => {
      const result = await replaceWorkspaceSpan(workspace, {
        path: args.path as string,
        startLine: args.startLine as number,
        endLine: args.endLine as number,
        replacement: args.replacement as string,
      });

      return jsonToolResult({
        command: "replace repomix span",
        ...result,
      });
    },
    workspace.policy,
    workspace.auditLogger,
  );

  server.registerTool(
    REPLACE_REPOMIX_SPAN_TOOL.name,
    {
      title: "Replace workspace span",
      description: `${tierLabel("replace_repomix_span")} Replace an exact line span in a live workspace file. This acts on the workspace filesystem, not bundle artifacts.`,
      inputSchema: z.object({
        path: z.string().min(1),
        startLine: z.number().int().positive(),
        endLine: z.number().int().positive(),
        replacement: z.string(),
      }),
    },
    replaceHandler,
  );
}
