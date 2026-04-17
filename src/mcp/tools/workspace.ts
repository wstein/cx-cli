import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { withPolicyEnforcement } from "../enforce.js";
import type { CxMcpWorkspace } from "../workspace.js";
import {
  grepWorkspaceFiles,
  listWorkspaceFiles,
  readWorkspaceFile,
  replaceWorkspaceSpan,
} from "../workspace.js";
import { jsonToolResult } from "./utils.js";

export function registerWorkspaceTools(
  server: McpServer,
  workspace: CxMcpWorkspace,
): void {
  const listHandler = withPolicyEnforcement(
    "list",
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
    "list",
    {
      title: "List workspace files",
      description:
        "List files from the cx workspace file scope using the active cx configuration.",
      inputSchema: z.object({
        prefix: z.string().optional(),
      }),
    },
    listHandler,
  );

  const grepHandler = withPolicyEnforcement(
    "grep",
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
    "grep",
    {
      title: "Search workspace files",
      description:
        "Search files from the cx workspace file scope with a string or regular expression.",
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
    "read",
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
    "read",
    {
      title: "Read workspace file",
      description:
        "Read a text file from the cx workspace scope with optional line anchors.",
      inputSchema: z.object({
        path: z.string().min(1),
        startLine: z.number().int().positive().optional(),
        endLine: z.number().int().positive().optional(),
      }),
    },
    readHandler,
  );

  const replaceHandler = withPolicyEnforcement(
    "replace_repomix_span",
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
    "replace_repomix_span",
    {
      title: "Replace workspace span",
      description:
        "Replace an exact line span in a live workspace file. This acts on the workspace filesystem, not bundle artifacts.",
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
