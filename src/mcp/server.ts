import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type { CxConfig } from "../config/types.js";
import { CX_VERSION } from "../shared/version.js";
import { AuditLogger } from "./audit.js";
import { resolvePolicy } from "./policy.js";
import type { McpRateLimiter, McpRequestLogger } from "./safeguards.js";
import { registerCxMcpTools } from "./tools/index.js";
import { createCxMcpWorkspace } from "./workspace.js";

export interface CxMcpServerOptions {
  configPath: string;
  config: CxConfig;
}

export interface CxMcpServerDeps {
  processExit?: (code: number) => void;
  connectTimeoutMs?: number;
  postConnectTimeoutMs?: number;
  writeStderr?: (message: string) => void;
  installSignalHandlers?: boolean;
  postConnectCheck?: () => Promise<void>;
}

const DEFAULT_CONNECT_TIMEOUT_MS = 15_000;
const DEFAULT_POST_CONNECT_TIMEOUT_MS = 15_000;

function formatStartupErrorReason(error: unknown): string {
  if (error instanceof Error && typeof error.message === "string") {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  if (typeof error === "object" && error !== null) {
    const maybeMessage = (
      error as {
        message?: unknown;
      }
    ).message;
    if (typeof maybeMessage === "string" && maybeMessage.length > 0) {
      return maybeMessage;
    }
    try {
      return JSON.stringify(error);
    } catch {
      return String(error);
    }
  }
  return String(error);
}

async function connectWithTimeout(
  connectPromise: Promise<unknown>,
  connectTimeoutMs: number,
): Promise<void> {
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      connectPromise,
      new Promise<never>((_resolve, reject) => {
        timeoutHandle = setTimeout(
          () =>
            reject(
              new Error(
                `MCP server connection timed out after ${connectTimeoutMs}ms.`,
              ),
            ),
          connectTimeoutMs,
        );
      }),
    ]);
  } finally {
    if (timeoutHandle !== undefined) {
      clearTimeout(timeoutHandle);
    }
  }
}

async function postConnectCheckWithTimeout(
  postConnectCheckPromise: Promise<void>,
  postConnectTimeoutMs: number,
): Promise<void> {
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      postConnectCheckPromise,
      new Promise<never>((_resolve, reject) => {
        timeoutHandle = setTimeout(
          () =>
            reject(
              new Error(
                `MCP post-connect readiness check timed out after ${postConnectTimeoutMs}ms.`,
              ),
            ),
          postConnectTimeoutMs,
        );
      }),
    ]);
  } finally {
    if (timeoutHandle !== undefined) {
      clearTimeout(timeoutHandle);
    }
  }
}

function buildInstructions(configPath: string): string {
  const toolReference = `
Tool reference:
Workspace: list (enumerate tracked files), grep (search file contents), read (fetch a file), replace_repomix_span (patch a span in a section output).
Planning: inspect (live bundle plan without writing artifacts), bundle (preview snapshot metadata).
Doctor: doctor_mcp (diagnose MCP profile), doctor_workflow (recommend inspect/bundle/mcp for a task), doctor_overlaps (find section file conflicts), doctor_secrets (scan for exposed secrets).
Notes: notes_new, notes_read, notes_update, notes_rename, notes_delete (note lifecycle); notes_search, notes_list (discovery); notes_backlinks, notes_orphans, notes_code_links, notes_links (graph queries).`;

  return [
    "cx mcp provides deterministic, file-based agent access to live repository context.",
    "Use cx inspect and the MCP live tools for planning against the workspace filesystem; use cx bundle locally for immutable snapshots and verification, not as a reasoning source inside MCP.",
    "Use cx mcp for interactive exploration, note maintenance, and live workspace changes.",
    "Use the cx-mcp.toml profile when present; fall back to cx.toml when the MCP profile is absent.",
    `Active profile: ${configPath}`,
    toolReference,
    "Stability: [STABLE] semver-protected · [BETA] schema may change · [EXPERIMENTAL] may be removed",
  ].join("\n");
}

export function createCxMcpServer(
  options: CxMcpServerOptions,
  _safeguards?: {
    logger?: McpRequestLogger;
    rateLimiter?: McpRateLimiter;
  },
): McpServer {
  const policy = resolvePolicy(options.config);
  const auditLogger = options.config.mcp.auditLogging
    ? new AuditLogger(".cx", options.config.mcp.auditLogging)
    : undefined;

  const workspaceOptions: {
    policy?: import("./policy.js").McpPolicy;
    auditLogger?: AuditLogger;
  } = { policy };
  if (auditLogger) {
    workspaceOptions.auditLogger = auditLogger;
  }

  const workspace = createCxMcpWorkspace(options.config, workspaceOptions);

  const server = new McpServer(
    {
      name: "cx-mcp-server",
      version: CX_VERSION,
    },
    {
      instructions: buildInstructions(options.configPath),
    },
  );

  // Instantiate safeguards for optional per-tool integration.
  // Tools can optionally use withTimeout(), rateLimiter.isAllowed(), and
  // logger.logStart/logEnd for request timing and audit trails.
  // See src/mcp/safeguards.ts for the API.
  // Note: Instantiating safeguards here makes them available, but actual
  // per-tool integration happens in individual tool implementations.

  registerCxMcpTools(server, workspace);

  return server;
}

export async function runCxMcpServer(
  configPath: string,
  config: CxConfig,
  deps: CxMcpServerDeps = {},
): Promise<void> {
  const server = createCxMcpServer({ configPath, config });
  const transport = new StdioServerTransport();
  const processExit = deps.processExit ?? process.exit;
  const writeStderr =
    deps.writeStderr ?? ((message) => process.stderr.write(message));
  const connectTimeoutMs = deps.connectTimeoutMs ?? DEFAULT_CONNECT_TIMEOUT_MS;
  const postConnectTimeoutMs =
    deps.postConnectTimeoutMs ?? DEFAULT_POST_CONNECT_TIMEOUT_MS;
  const installSignalHandlers = deps.installSignalHandlers ?? true;
  const postConnectCheck = deps.postConnectCheck;

  const clearSignalHandlers = (): void => {
    process.off("SIGINT", handleExit);
    process.off("SIGTERM", handleExit);
  };

  const handleExit = async (): Promise<void> => {
    clearSignalHandlers();
    try {
      await server.close();
      processExit(0);
    } catch {
      processExit(1);
    }
  };

  if (installSignalHandlers) {
    process.on("SIGINT", handleExit);
    process.on("SIGTERM", handleExit);
  }

  try {
    await connectWithTimeout(server.connect(transport), connectTimeoutMs);
    if (postConnectCheck !== undefined) {
      await postConnectCheckWithTimeout(
        postConnectCheck(),
        postConnectTimeoutMs,
      );
    }
  } catch (error) {
    clearSignalHandlers();
    const reason = formatStartupErrorReason(error);
    writeStderr(`Error: failed to start cx mcp server: ${reason}\n`);
    processExit(1);
  }
}
