import fs from "node:fs/promises";
import path from "node:path";

import { CxError } from "../shared/errors.js";

const MCP_PROFILE_NAME = "cx-mcp.toml";
const BASE_PROFILE_NAME = "cx.toml";

async function defaultFileExists(filePath: string): Promise<boolean> {
  try {
    const stats = await fs.stat(filePath);
    return stats.isFile();
  } catch {
    return false;
  }
}

export interface ResolveMcpConfigPathDeps {
  fileExists?: (filePath: string) => Promise<boolean>;
}

/**
 * Resolve the active MCP config path for a given working directory.
 *
 * Prefers cx-mcp.toml when present, falls back to cx.toml. Throws if neither
 * file exists so the MCP server and related diagnostics fail early with a
 * clear error.
 */
export async function resolveMcpConfigPath(
  cwd: string,
  deps: ResolveMcpConfigPathDeps = {},
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
