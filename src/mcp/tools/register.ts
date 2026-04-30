import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { checkToolAccess, PolicyError } from "../policy.js";
import type { CxMcpWorkspace } from "../workspace.js";
import type { CxMcpToolDefinition } from "./catalog.js";

const DEFAULT_TOOL_TIMEOUT_MS = 15_000;

interface TextToolContentBlock {
  type: "text";
  text: string;
}

interface ToolResultPayload {
  content: TextToolContentBlock[];
}

interface CxMcpToolRuntimeOptions {
  toolTimeoutMs?: number;
}

function formatMalformedResultMessage(toolName: string, reason: string): Error {
  return new Error(
    `MCP tool "${toolName}" returned malformed payload: ${reason}`,
  );
}

function assertToolResultPayload(
  toolName: string,
  payload: unknown,
): asserts payload is ToolResultPayload {
  if (typeof payload !== "object" || payload === null) {
    throw formatMalformedResultMessage(
      toolName,
      'expected an object with a "content" array.',
    );
  }

  const maybeContent = (payload as { content?: unknown }).content;
  if (!Array.isArray(maybeContent)) {
    throw formatMalformedResultMessage(
      toolName,
      'missing required "content" array.',
    );
  }

  for (let index = 0; index < maybeContent.length; index += 1) {
    const block = maybeContent[index];
    if (typeof block !== "object" || block === null) {
      throw formatMalformedResultMessage(
        toolName,
        `content[${index}] must be an object.`,
      );
    }

    const contentType = (block as { type?: unknown }).type;
    if (contentType !== "text") {
      throw formatMalformedResultMessage(
        toolName,
        `content[${index}] must have type "text".`,
      );
    }

    const text = (block as { text?: unknown }).text;
    if (typeof text !== "string") {
      throw formatMalformedResultMessage(
        toolName,
        `content[${index}].text must be a string.`,
      );
    }
  }
}

async function withToolTimeout<T>(
  toolName: string,
  toolTimeoutMs: number,
  promise: Promise<T>,
): Promise<T> {
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_resolve, reject) => {
        timeoutHandle = setTimeout(
          () =>
            reject(
              new Error(
                `MCP tool "${toolName}" timed out after ${toolTimeoutMs}ms.`,
              ),
            ),
          toolTimeoutMs,
        );
      }),
    ]);
  } finally {
    if (timeoutHandle !== undefined) {
      clearTimeout(timeoutHandle);
    }
  }
}

export function registerCxMcpTool<TSchema, TResult>(
  server: McpServer,
  workspace: CxMcpWorkspace,
  tool: CxMcpToolDefinition,
  metadata: {
    title: string;
    description: string;
    inputSchema: TSchema;
  },
  handler: (args: Record<string, unknown>) => Promise<TResult>,
  runtimeOptions: CxMcpToolRuntimeOptions = {},
): void {
  const toolTimeoutMs = runtimeOptions.toolTimeoutMs ?? DEFAULT_TOOL_TIMEOUT_MS;

  server.registerTool(
    tool.name,
    metadata as Parameters<McpServer["registerTool"]>[1],
    (async (args: Record<string, unknown>) => {
      const decision = checkToolAccess(tool, workspace.policy);
      const baseAuditMetadata = {
        decisionBasis: decision.decisionBasis,
        policyName: decision.policyName,
      };

      if (!decision.allowed) {
        await workspace.auditLogger?.logToolEvent({
          tool: tool.name,
          capability: decision.capability,
          decision: "denied",
          reason: decision.reason,
          args,
          execution: {
            status: "denied",
          },
          metadata: baseAuditMetadata,
        });
        throw new PolicyError(
          tool.name,
          decision.capability,
          `Access denied: ${decision.reason}`,
        );
      }

      const startedAt = Date.now();
      try {
        const result = await withToolTimeout(
          tool.name,
          toolTimeoutMs,
          handler(args),
        );
        assertToolResultPayload(tool.name, result);
        await workspace.auditLogger?.logToolEvent({
          tool: tool.name,
          capability: decision.capability,
          decision: "allowed",
          reason: decision.reason,
          args,
          execution: {
            durationMs: Date.now() - startedAt,
            status: "succeeded",
          },
          metadata: baseAuditMetadata,
        });
        return result;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        const timedOut = errorMessage.includes(" timed out after ");
        await workspace.auditLogger?.logToolEvent({
          tool: tool.name,
          capability: decision.capability,
          decision: "allowed",
          reason: decision.reason,
          args,
          execution: {
            durationMs: Date.now() - startedAt,
            ...(timedOut ? {} : { error: errorMessage }),
            status: timedOut ? "timed_out" : "failed",
          },
          metadata: baseAuditMetadata,
        });
        throw error;
      }
    }) as Parameters<McpServer["registerTool"]>[2],
  );
}
