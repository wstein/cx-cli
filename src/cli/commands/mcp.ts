import path from "node:path";

import { loadCxConfig } from "../../config/load.js";
import type { CxConfig } from "../../config/types.js";
import { resolveMcpConfigPath } from "../../mcp/config.js";
import { runCxMcpServer } from "../../mcp/server.js";

export { resolveMcpConfigPath } from "../../mcp/config.js";

export interface McpDeps {
  fileExists?: (filePath: string) => Promise<boolean>;
  loadConfig?: typeof loadCxConfig;
  startServer?: (configPath: string, config: CxConfig) => Promise<void>;
}

export interface McpArgs {
  cwd?: string;
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
