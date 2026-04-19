import path from "node:path";

import { loadCxConfig } from "../../config/load.js";
import type { CxConfig } from "../../config/types.js";
import { resolveMcpConfigPath } from "../../mcp/config.js";
import { runCxMcpServer } from "../../mcp/server.js";
import {
  CX_MCP_TOOL_CATALOG_VERSION,
  getCxMcpToolCatalog,
  summarizeCxMcpToolCatalog,
} from "../../mcp/tools/catalog.js";
import { type CommandIo, writeJson, writeStdout } from "../../shared/output.js";

export { resolveMcpConfigPath } from "../../mcp/config.js";

export interface McpDeps {
  fileExists?: (filePath: string) => Promise<boolean>;
  loadConfig?: typeof loadCxConfig;
  startServer?: (configPath: string, config: CxConfig) => Promise<void>;
}

export interface McpArgs {
  cwd?: string;
}

export interface McpCatalogArgs {
  json?: boolean | undefined;
}

export interface McpCatalogReport {
  command: "mcp catalog";
  toolCatalogVersion: typeof CX_MCP_TOOL_CATALOG_VERSION;
  toolCatalog: ReturnType<typeof getCxMcpToolCatalog>;
  toolCatalogSummary: ReturnType<typeof summarizeCxMcpToolCatalog>;
}

export function collectMcpCatalogReport(): McpCatalogReport {
  const toolCatalog = getCxMcpToolCatalog();

  return {
    command: "mcp catalog",
    toolCatalogVersion: CX_MCP_TOOL_CATALOG_VERSION,
    toolCatalog,
    toolCatalogSummary: summarizeCxMcpToolCatalog(toolCatalog),
  };
}

export function printMcpCatalogReport(
  report: McpCatalogReport,
  json: boolean,
  io: Partial<CommandIo> = {},
): void {
  if (json) {
    writeJson(report, io);
    return;
  }

  writeStdout(
    `MCP tool catalog: v${report.toolCatalogVersion}, ${report.toolCatalogSummary.totalTools} tools\n`,
    io,
  );
  writeStdout(`By capability:\n`, io);
  for (const [capability, count] of Object.entries(
    report.toolCatalogSummary.byCapability,
  )) {
    writeStdout(`  - ${capability}: ${count}\n`, io);
  }
  writeStdout(`By stability:\n`, io);
  for (const [stability, count] of Object.entries(
    report.toolCatalogSummary.byStability,
  )) {
    writeStdout(`  - ${stability}: ${count}\n`, io);
  }
  writeStdout(`Tools:\n`, io);
  for (const tool of report.toolCatalog) {
    writeStdout(
      `  - ${tool.name}: ${tool.capability}, ${tool.stability}\n`,
      io,
    );
  }
}

export async function runMcpCatalogCommand(
  args: McpCatalogArgs = {},
  io: Partial<CommandIo> = {},
): Promise<number> {
  const report = collectMcpCatalogReport();
  printMcpCatalogReport(report, args.json ?? false, io);
  return 0;
}

export async function runMcpCommand(
  args: McpArgs = {},
  deps: McpDeps = {},
): Promise<number> {
  const cwd = path.resolve(args.cwd ?? process.cwd());
  const loadConfig = deps.loadConfig ?? loadCxConfig;
  const startServer = deps.startServer ?? runCxMcpServer;
  const configPath = await resolveMcpConfigPath(
    cwd,
    deps.fileExists === undefined ? {} : { fileExists: deps.fileExists },
  );
  const config = await loadConfig(configPath);

  await startServer(configPath, config);

  return 0;
}
