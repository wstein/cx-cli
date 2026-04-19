import type { McpCapability } from "../capabilities.js";
import type { StabilityTier } from "../tiers.js";
import { BUNDLE_TOOL_DEFINITIONS } from "./bundle.js";
import { DOCTOR_TOOL_DEFINITIONS } from "./doctor.js";
import { NOTES_TOOL_DEFINITIONS } from "./notes.js";
import { WORKSPACE_TOOL_DEFINITIONS } from "./workspace.js";

export interface CxMcpToolDefinition {
  readonly name: string;
  readonly capability: McpCapability;
  readonly stability: StabilityTier;
}

export const CX_MCP_TOOL_DEFINITIONS: readonly CxMcpToolDefinition[] = [
  ...WORKSPACE_TOOL_DEFINITIONS,
  ...BUNDLE_TOOL_DEFINITIONS,
  ...DOCTOR_TOOL_DEFINITIONS,
  ...NOTES_TOOL_DEFINITIONS,
];

export const CX_MCP_TOOL_CAPABILITIES = Object.freeze(
  Object.fromEntries(
    CX_MCP_TOOL_DEFINITIONS.map((tool) => [tool.name, tool.capability]),
  ) as Record<string, McpCapability>,
);

export const CX_MCP_TOOL_STABILITY = Object.freeze(
  Object.fromEntries(
    CX_MCP_TOOL_DEFINITIONS.map((tool) => [tool.name, tool.stability]),
  ) as Record<string, StabilityTier>,
);

export const CX_MCP_TOOL_DEFINITION_MAP = Object.freeze(
  Object.fromEntries(
    CX_MCP_TOOL_DEFINITIONS.map((tool) => [tool.name, tool]),
  ) as Record<string, CxMcpToolDefinition>,
);

export const CX_MCP_TOOL_NAMES = Object.freeze(
  CX_MCP_TOOL_DEFINITIONS.map((tool) => tool.name),
);

export function getCxMcpToolCapability(
  toolName: string,
): McpCapability | undefined {
  return CX_MCP_TOOL_CAPABILITIES[toolName];
}

export function getCxMcpToolStability(
  toolName: string,
): StabilityTier | undefined {
  return CX_MCP_TOOL_STABILITY[toolName];
}

export function getCxMcpToolDefinition(
  toolName: string,
): CxMcpToolDefinition | undefined {
  return CX_MCP_TOOL_DEFINITION_MAP[toolName];
}
