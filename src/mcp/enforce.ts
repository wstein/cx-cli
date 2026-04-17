import type { AuditLogger } from "./audit.js";
import { checkToolAccess, PolicyError, resolvePolicy } from "./policy.js";

/**
 * Tool enforcement wrapper: checks policy before executing a tool handler.
 * Throws PolicyError if access is denied, logs decision to audit trail.
 */
export async function enforceToolAccess<T>(
  toolName: string,
  handler: () => Promise<T>,
  auditLogger?: AuditLogger,
): Promise<T> {
  const policy = resolvePolicy();
  const decision = checkToolAccess(toolName, policy);

  if (auditLogger) {
    await auditLogger.logToolAccess(
      toolName,
      decision.capability,
      decision.allowed,
      decision.reason,
    );
  }

  if (!decision.allowed) {
    throw new PolicyError(
      toolName,
      decision.capability,
      `Access denied: ${decision.reason}`,
    );
  }

  return handler();
}

/**
 * Create a policy-enforcing tool handler wrapper.
 * Returns a function that enforces policy before calling the original handler.
 */
export function withPolicyEnforcement<Args extends Record<string, unknown>>(
  toolName: string,
  handler: (args: Args) => Promise<string>,
  auditLogger?: AuditLogger,
) {
  return async (args: Args): Promise<string> => {
    return enforceToolAccess(
      toolName,
      () => handler(args),
      auditLogger,
    );
  };
}
