import path from "node:path";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { runDocsCommand } from "../../adapter/cliParity.js";
import { tierLabel } from "../tiers.js";
import type { CxMcpWorkspace } from "../workspace.js";
import type { CxMcpToolDefinition } from "./catalog.js";
import { runJsonCommandPayload } from "./command.js";
import { registerCxMcpTool } from "./register.js";
import { jsonToolResult } from "./utils.js";

const DOCS_COMPILE_TOOL = {
  name: "docs_compile",
  capability: "mutate",
  stability: "STABLE",
} as const satisfies CxMcpToolDefinition;
const DOCS_DRIFT_TOOL = {
  name: "docs_drift",
  capability: "observe",
  stability: "STABLE",
} as const satisfies CxMcpToolDefinition;
const DOCS_EXPORT_TOOL = {
  name: "docs_export",
  capability: "mutate",
  stability: "STABLE",
} as const satisfies CxMcpToolDefinition;

export const DOCS_TOOL_DEFINITIONS = [
  DOCS_COMPILE_TOOL,
  DOCS_DRIFT_TOOL,
  DOCS_EXPORT_TOOL,
] as const satisfies readonly CxMcpToolDefinition[];

const docsProfileSchema = z.enum(["architecture", "manual", "onboarding"]);

export function registerDocsTools(
  server: McpServer,
  workspace: CxMcpWorkspace,
): void {
  registerCxMcpTool(
    server,
    workspace,
    DOCS_COMPILE_TOOL,
    {
      title: "Compile docs from notes",
      description: `${tierLabel(DOCS_COMPILE_TOOL.stability)} Run cx docs compile for a profile and write generated Antora pages.`,
      inputSchema: z.object({
        profile: docsProfileSchema.default("architecture"),
      }),
    },
    async (args: Record<string, unknown>) =>
      jsonToolResult(
        await runJsonCommandPayload(workspace.sourceRoot, (io) =>
          runDocsCommand(
            {
              subcommand: "compile",
              config: path.join(workspace.sourceRoot, "cx.toml"),
              profile:
                typeof args.profile === "string"
                  ? args.profile
                  : "architecture",
              json: true,
            },
            io,
          ),
        ),
      ),
  );

  registerCxMcpTool(
    server,
    workspace,
    DOCS_DRIFT_TOOL,
    {
      title: "Check docs drift",
      description: `${tierLabel(DOCS_DRIFT_TOOL.stability)} Run cx docs drift for generated Antora note pages.`,
      inputSchema: z.object({
        profile: docsProfileSchema.optional(),
      }),
    },
    async (args: Record<string, unknown>) =>
      jsonToolResult(
        await runJsonCommandPayload(workspace.sourceRoot, (io) =>
          runDocsCommand(
            {
              subcommand: "drift",
              config: path.join(workspace.sourceRoot, "cx.toml"),
              ...(typeof args.profile === "string" && {
                profile: args.profile,
              }),
              json: true,
            },
            io,
          ),
        ),
      ),
  );

  registerCxMcpTool(
    server,
    workspace,
    DOCS_EXPORT_TOOL,
    {
      title: "Export Antora docs",
      description: `${tierLabel(DOCS_EXPORT_TOOL.stability)} Run cx docs export and write reviewable Antora markdown artifacts.`,
      inputSchema: z.object({
        outputDir: z.string().min(1).optional(),
        playbook: z.string().min(1).optional(),
        rootLevel: z.union([z.literal(0), z.literal(1)]).optional(),
        logOutput: z.string().min(1).optional(),
      }),
    },
    async (args: Record<string, unknown>) =>
      jsonToolResult(
        await runJsonCommandPayload(workspace.sourceRoot, (io) =>
          runDocsCommand(
            {
              subcommand: "export",
              config: path.join(workspace.sourceRoot, "cx.toml"),
              ...(typeof args.outputDir === "string" && {
                outputDir: args.outputDir,
              }),
              ...(typeof args.playbook === "string" && {
                playbook: args.playbook,
              }),
              ...(typeof args.rootLevel === "number" &&
                (args.rootLevel === 0 || args.rootLevel === 1) && {
                  rootLevel: args.rootLevel,
                }),
              ...(typeof args.logOutput === "string" && {
                logOutput: args.logOutput,
              }),
              json: true,
            },
            io,
          ),
        ),
      ),
  );
}
