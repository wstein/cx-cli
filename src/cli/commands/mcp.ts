import fs from "node:fs/promises";
import path from "node:path";

import { loadCxConfig } from "../../config/load.js";
import { runCxMcpServer } from "../../mcp/server.js";
import type { CxConfig } from "../../config/types.js";
import { CxError } from "../../shared/errors.js";

const MCP_PROFILE_NAME = "cx-mcp.toml";
const BASE_PROFILE_NAME = "cx.toml";

export interface McpDeps {
  fileExists?: (filePath: string) => Promise<boolean>;
  loadConfig?: typeof loadCxConfig;
  startServer?: (configPath: string, config: CxConfig) => Promise<void>;
}

export interface McpArgs {
  cwd?: string;
}

async function defaultFileExists(filePath: string): Promise<boolean> {
  try {
    const stats = await fs.stat(filePath);
    return stats.isFile();
  } catch {
    return false;
  }
}

export async function resolveMcpConfigPath(
  cwd: string,
  deps: Pick<McpDeps, "fileExists"> = {},
): Promise<string> {
  const fileExists = deps.fileExists ?? defaultFileExists;
  const resolvedCwd = path.resolve(cwd);
  const mcpConfigPath = path.join(resolvedCwd, MCP_PROFILE_NAME);
  if (await fileExists(mcpConfigPath)) {
    return mcpConfigPath;
  }

  const baseConfigPath = path.join(resolvedCwd, BASE_PROFILE_NAME);
  if (await fileExists(baseConfigPath)) {
    return baseConfigPath;
  }

  throw new CxError(
    `Unable to start cx mcp. Expected ${MCP_PROFILE_NAME} or ${BASE_PROFILE_NAME} in ${resolvedCwd}.`,
  );
}

export async function runMcpCommand(
  args: McpArgs = {},
  deps: McpDeps = {},
): Promise<number> {
  const cwd = path.resolve(args.cwd ?? process.cwd());
  const loadConfig = deps.loadConfig ?? loadCxConfig;
  const startServer = deps.startServer ?? runCxMcpServer;
  const configPath = await resolveMcpConfigPath(cwd, {
    fileExists: deps.fileExists,
  });
  const config = await loadConfig(configPath);

  await startServer(configPath, config);

  return 0;
}
