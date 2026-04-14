import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import type { CxMcpWorkspace } from "./workspace.js";
import {
  grepWorkspaceFiles,
  listWorkspaceFiles,
  readWorkspaceFile,
} from "./workspace.js";

function jsonToolResult(value: unknown): {
  content: Array<{ type: "text"; text: string }>;
} {
  return {
    content: [
      {
        type: "text",
        text: `${JSON.stringify(value, null, 2)}\n`,
      },
    ],
  };
}

export function registerCxMcpTools(
  server: McpServer,
  workspace: CxMcpWorkspace,
): void {
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
    async (args) => {
      const files = await listWorkspaceFiles(workspace, args.prefix);
      return jsonToolResult({
        sourceRoot: workspace.sourceRoot,
        fileCount: files.length,
        files,
      });
    },
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
    async (args) => {
      const query = {
        pattern: args.pattern,
        ...(args.regex !== undefined ? { regex: args.regex } : {}),
        ...(args.caseSensitive !== undefined
          ? { caseSensitive: args.caseSensitive }
          : {}),
        ...(args.prefix !== undefined ? { prefix: args.prefix } : {}),
        ...(args.limit !== undefined ? { limit: args.limit } : {}),
      };
      const result = await grepWorkspaceFiles(workspace, query);

      return jsonToolResult(result);
    },
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
    async (args) => {
      const query = {
        path: args.path,
        ...(args.startLine !== undefined ? { startLine: args.startLine } : {}),
        ...(args.endLine !== undefined ? { endLine: args.endLine } : {}),
      };
      const result = await readWorkspaceFile(workspace, query);

      return jsonToolResult(result);
    },
  );
}
