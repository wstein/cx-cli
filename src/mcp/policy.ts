import type { CxConfig } from "../config/types.js";
import { CxError, type ErrorRemediation } from "../shared/errors.js";
import type { McpCapability } from "./capabilities.js";
import {
  getCxMcpToolDefinition,
  type CxMcpToolDefinition,
} from "./tools/catalog.js";

/**
 * File scope configuration for a policy.
 * Controls which paths a tool can access.
 */
export interface FileScope {
  include: string[]; // Glob patterns
  exclude: string[]; // Glob patterns to exclude from include
}

/**
 * MCP policy: defines which capabilities are allowed and denied.
 * Deny-by-default: capabilities must be explicitly allowed.
 */
export interface McpPolicy {
  /** Capabilities explicitly allowed. Others are denied. */
  allow: McpCapability[];

  /** Additional capabilities to deny (overrides allow). */
  deny?: McpCapability[];

  /** File scope: which paths can be accessed. */
  scope?: FileScope;

  /** Human-readable policy name. */
  name?: string;
}

/**
 * Tool access decision result.
 */
export interface ToolAccessDecision {
  allowed: boolean;
  reason: string;
  capability: McpCapability;
}

function resolveToolDefinition(
  tool: string | CxMcpToolDefinition,
): CxMcpToolDefinition | undefined {
  return typeof tool === "string" ? getCxMcpToolDefinition(tool) : tool;
}

/**
 * Audit event for policy enforcement.
 */
export interface AuditEvent {
  timestamp: string;
  tool: string;
  capability: McpCapability;
  path?: string;
  decision: "allowed" | "denied";
  reason: string;
}

/**
 * Default policy: deny all mutate, allow read/observe/plan.
 * Used when no policy is explicitly configured.
 */
export const DEFAULT_POLICY: McpPolicy = {
  allow: ["read", "observe", "plan"],
  deny: ["mutate"],
  name: "default-deny-mutate",
};

/**
 * Strict policy: only read and observe, deny plan and mutate.
 * Used for sensitive codebases or production CI.
 */
export const STRICT_POLICY: McpPolicy = {
  allow: ["read", "observe"],
  deny: ["plan", "mutate"],
  name: "strict-read-only",
};

/**
 * Unrestricted policy: allow all capabilities.
 * Used for local development only.
 */
export const UNRESTRICTED_POLICY: McpPolicy = {
  allow: ["read", "observe", "plan", "mutate"],
  name: "unrestricted",
};

/**
 * Determine if a capability is allowed by a policy.
 */
export function isCapabilityAllowed(
  policy: McpPolicy,
  capability: McpCapability,
): boolean {
  // If capability is in deny list, it's denied
  if (policy.deny?.includes(capability)) {
    return false;
  }

  // If capability is in allow list, it's allowed
  if (policy.allow.includes(capability)) {
    return true;
  }

  // Otherwise, it's denied (deny-by-default)
  return false;
}

/**
 * Check if a tool is allowed to execute under a policy.
 * Returns decision with reason.
 */
export function checkToolAccess(
  tool: string | CxMcpToolDefinition,
  policy: McpPolicy,
): ToolAccessDecision {
  const resolvedTool = resolveToolDefinition(tool);
  const toolName = typeof tool === "string" ? tool : tool.name;

  if (!resolvedTool) {
    return {
      allowed: false,
      reason: `Unknown tool: ${toolName}`,
      capability: "read", // Default for unknown
    };
  }

  const allowed = isCapabilityAllowed(policy, resolvedTool.capability);
  const reason = allowed
    ? `Tool ${toolName} (capability: ${resolvedTool.capability}) is allowed`
    : `Tool ${toolName} (capability: ${resolvedTool.capability}) is denied by policy`;

  return {
    allowed,
    reason,
    capability: resolvedTool.capability,
  };
}

/**
 * Resolve policy from config or use default.
 */
export function resolvePolicy(config?: CxConfig): McpPolicy {
  switch (config?.mcp.policy) {
    case "strict":
      return STRICT_POLICY;
    case "unrestricted":
      return UNRESTRICTED_POLICY;
    default:
      return DEFAULT_POLICY;
  }
}

/**
 * Policy enforcement error.
 */
export class PolicyError extends CxError {
  readonly toolName: string;
  readonly capability: McpCapability;

  constructor(
    toolName: string,
    capability: McpCapability,
    message: string,
    exitCode = 15,
  ) {
    super(message, exitCode, {
      remediation: buildPolicyRemediation(toolName, capability),
    });
    this.toolName = toolName;
    this.capability = capability;
  }
}

function buildPolicyRemediation(
  toolName: string,
  capability: McpCapability,
): ErrorRemediation {
  return {
    recommendedCommand: "cx doctor mcp --config cx.toml",
    docsRef: "docs/MCP_TOOL_INTENT_TAXONOMY.md",
    nextSteps: [
      `Confirm that ${toolName} is allowed for ${capability} operations under the active MCP policy.`,
      "Adjust cx-mcp.toml or cx.toml if this tool should be available in the current session.",
    ],
  };
}
