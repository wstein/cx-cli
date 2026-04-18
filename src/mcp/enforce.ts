import type { AuditLogger } from "./audit.js";
import { checkToolAccess, type McpPolicy, PolicyError } from "./policy.js";
import type { CxMcpToolDefinition } from "./tools/catalog.js";

/**
 * Tool enforcement wrapper: checks policy before executing a tool handler.
 * Throws PolicyError if access is denied, logs decision to audit trail.
 */
export async function enforceToolAccess<T>(
  tool: CxMcpToolDefinition,
  handler: () => Promise<T>,
  policy: McpPolicy,
  auditLogger?: AuditLogger,
): Promise<T> {
  const decision = checkToolAccess(tool, policy);

  if (auditLogger) {
    await auditLogger.logToolAccess(
      tool.name,
      decision.capability,
      decision.allowed,
      decision.reason,
    );
  }

  if (!decision.allowed) {
    throw new PolicyError(
      tool.name,
      decision.capability,
      `Access denied: ${decision.reason}`,
    );
  }

  return handler();
}

/**
 * Create a policy-enforcing tool handler wrapper.
 * Returns a function that enforces policy before calling the original handler.
 * Works with MCP SDK handlers that return TextContent[].
 */
export function withPolicyEnforcement<T>(
  tool: CxMcpToolDefinition,
  handler: (args: Record<string, unknown>) => Promise<T>,
  policy: McpPolicy,
  auditLogger?: AuditLogger,
): (args: Record<string, unknown>) => Promise<T> {
  return async (args: Record<string, unknown>): Promise<T> => {
    return enforceToolAccess(
      tool,
      () => handler(args),
      policy,
      auditLogger,
    );
  };
}
