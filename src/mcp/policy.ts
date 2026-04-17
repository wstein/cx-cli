import type { CxConfig } from "../config/types.js";
import { CxError } from "../shared/errors.js";

/**
 * MCP tool capability classification.
 *
 * - read: Retrieve workspace content without modification
 * - observe: Analyze workspace state (plans, metadata, diagnostics)
 * - plan: Generate artifacts (inspect, bundle plans)
 * - mutate: Modify workspace state (notes CRUD, file writes)
 */
export type McpCapability = "read" | "observe" | "plan" | "mutate";

/**
 * Tool capability mapping: which MCP tools require which capabilities.
 */
export const TOOL_CAPABILITIES: Record<string, McpCapability> = {
  // Workspace (read)
  workspace_list: "read",
  workspace_grep: "read",
  workspace_read: "read",

  // Bundle (plan)
  bundle: "plan",
  bundle_preview: "plan",

  // Doctor (observe)
  doctor_mcp: "observe",
  doctor_overlaps: "observe",
  doctor_secrets: "observe",
  doctor_workflow: "observe",

  // Notes (mutate)
  notes_new: "mutate",
  notes_read: "observe", // Reading is observe, not mutate
  notes_update: "mutate",
  notes_delete: "mutate",
  notes_rename: "mutate",
  notes_search: "observe",
  notes_list: "observe",
};

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
  toolName: string,
  policy: McpPolicy,
): ToolAccessDecision {
  const capability = TOOL_CAPABILITIES[toolName];

  if (!capability) {
    return {
      allowed: false,
      reason: `Unknown tool: ${toolName}`,
      capability: "read", // Default for unknown
    };
  }

  const allowed = isCapabilityAllowed(policy, capability);
  const reason = allowed
    ? `Tool ${toolName} (capability: ${capability}) is allowed`
    : `Tool ${toolName} (capability: ${capability}) is denied by policy`;

  return {
    allowed,
    reason,
    capability,
  };
}

/**
 * Resolve policy from config or use default.
 */
export function resolvePolicy(config?: CxConfig): McpPolicy {
  // TODO: In the future, read policy from config.mcp.policy
  // For now, use default
  return DEFAULT_POLICY;
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
    super(message, exitCode);
    this.toolName = toolName;
    this.capability = capability;
  }
}
