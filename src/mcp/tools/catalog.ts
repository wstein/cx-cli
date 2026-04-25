import type { McpCapability } from "../capabilities.js";
import type { StabilityTier } from "../tiers.js";
import { BUNDLE_TOOL_DEFINITIONS } from "./bundle.js";
import { CONFIG_TOOL_DEFINITIONS } from "./config.js";
import { DOCS_TOOL_DEFINITIONS } from "./docs.js";
import { DOCTOR_TOOL_DEFINITIONS } from "./doctor.js";
import { EXTRACT_TOOL_DEFINITIONS } from "./extract.js";
import { META_TOOL_DEFINITIONS } from "./meta.js";
import { NOTES_TOOL_DEFINITIONS } from "./notes.js";
import { WORKSPACE_TOOL_DEFINITIONS } from "./workspace.js";

export interface CxMcpToolDefinition {
  readonly name: string;
  readonly capability: McpCapability;
  readonly stability: StabilityTier;
}

export interface CxMcpToolCatalogEntry {
  name: string;
  capability: McpCapability;
  stability: StabilityTier;
}

export interface CxMcpToolCatalogSummary {
  totalTools: number;
  byCapability: Record<McpCapability, number>;
  byStability: Record<StabilityTier, number>;
}

export const CX_MCP_TOOL_CATALOG_VERSION = 1;

export const CX_MCP_TOOL_DEFINITIONS: readonly CxMcpToolDefinition[] = [
  ...WORKSPACE_TOOL_DEFINITIONS,
  ...BUNDLE_TOOL_DEFINITIONS,
  ...EXTRACT_TOOL_DEFINITIONS,
  ...DOCTOR_TOOL_DEFINITIONS,
  ...NOTES_TOOL_DEFINITIONS,
  ...DOCS_TOOL_DEFINITIONS,
  ...CONFIG_TOOL_DEFINITIONS,
  ...META_TOOL_DEFINITIONS,
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

export function getCxMcpToolCatalog(): CxMcpToolCatalogEntry[] {
  return [...CX_MCP_TOOL_DEFINITIONS]
    .map((tool) => ({
      name: tool.name,
      capability: tool.capability,
      stability: tool.stability,
    }))
    .sort((left, right) => left.name.localeCompare(right.name, "en"));
}

export function summarizeCxMcpToolCatalog(
  toolCatalog: readonly CxMcpToolCatalogEntry[],
): CxMcpToolCatalogSummary {
  const byCapability: Record<McpCapability, number> = {
    read: 0,
    observe: 0,
    plan: 0,
    mutate: 0,
  };
  const byStability: Record<StabilityTier, number> = {
    STABLE: 0,
    BETA: 0,
    EXPERIMENTAL: 0,
    INTERNAL: 0,
  };

  for (const tool of toolCatalog) {
    byCapability[tool.capability] += 1;
    byStability[tool.stability] += 1;
  }

  return {
    totalTools: toolCatalog.length,
    byCapability,
    byStability,
  };
}
