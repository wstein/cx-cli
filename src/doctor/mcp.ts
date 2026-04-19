import path from "node:path";

import { loadCxConfig } from "../config/load.js";
import { type AuditSummary, collectAuditSummary } from "../mcp/audit.js";
import type { McpCapability } from "../mcp/capabilities.js";
import { resolveMcpConfigPath } from "../mcp/config.js";
import type { StabilityTier } from "../mcp/tiers.js";
import { CX_MCP_TOOL_DEFINITIONS } from "../mcp/tools/catalog.js";
import { type CommandIo, writeJson, writeStdout } from "../shared/output.js";

export interface DoctorMcpArgs {
  config?: string | undefined;
  json?: boolean | undefined;
}

export interface DoctorMcpToolCatalogEntry {
  name: string;
  capability: McpCapability;
  stability: StabilityTier;
}

export interface DoctorMcpToolCatalogSummary {
  totalTools: number;
  byCapability: Record<McpCapability, number>;
  byStability: Record<StabilityTier, number>;
}

export interface DoctorMcpReport {
  resolvedConfigPath: string;
  activeProfile: string;
  filesInclude: string[];
  filesExclude: string[];
  sectionNames: string[];
  policy: "default" | "strict" | "unrestricted";
  mutationEnabled: boolean;
  auditSummary: AuditSummary;
  toolCatalogVersion: 1;
  toolCatalog: DoctorMcpToolCatalogEntry[];
  toolCatalogSummary: DoctorMcpToolCatalogSummary;
}

export interface DoctorMcpDeps {
  loadConfig?: typeof loadCxConfig;
  resolveProfilePath?: typeof resolveMcpConfigPath;
  readAuditSummary?: typeof collectAuditSummary;
}

function buildDoctorMcpToolCatalog(): DoctorMcpToolCatalogEntry[] {
  return [...CX_MCP_TOOL_DEFINITIONS]
    .map((tool) => ({
      name: tool.name,
      capability: tool.capability,
      stability: tool.stability,
    }))
    .sort((left, right) => left.name.localeCompare(right.name, "en"));
}

function summarizeDoctorMcpToolCatalog(
  toolCatalog: DoctorMcpToolCatalogEntry[],
): DoctorMcpToolCatalogSummary {
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

export async function collectDoctorMcpReport(
  args: DoctorMcpArgs,
  deps: DoctorMcpDeps = {},
): Promise<DoctorMcpReport> {
  const loadConfig = deps.loadConfig ?? loadCxConfig;
  const resolveProfilePath = deps.resolveProfilePath ?? resolveMcpConfigPath;
  const readAuditSummary = deps.readAuditSummary ?? collectAuditSummary;
  const baseConfigPath = path.resolve(args.config ?? "cx.toml");
  const resolvedConfigPath = await resolveProfilePath(
    path.dirname(baseConfigPath),
  );
  const config = await loadConfig(resolvedConfigPath);
  const auditSummary = await readAuditSummary(config.sourceRoot);
  const toolCatalog = buildDoctorMcpToolCatalog();

  return {
    resolvedConfigPath,
    activeProfile: path.basename(resolvedConfigPath),
    filesInclude: config.files.include,
    filesExclude: config.files.exclude,
    sectionNames: Object.keys(config.sections).sort((left, right) =>
      left.localeCompare(right, "en"),
    ),
    policy: config.mcp.policy ?? "default",
    mutationEnabled: config.mcp.enableMutation ?? false,
    auditSummary,
    toolCatalogVersion: 1,
    toolCatalog,
    toolCatalogSummary: summarizeDoctorMcpToolCatalog(toolCatalog),
  };
}

export function printDoctorMcpReport(
  report: DoctorMcpReport,
  json: boolean,
  io: Partial<CommandIo> = {},
): void {
  if (json) {
    writeJson(report, io);
    return;
  }

  writeStdout(`Resolved MCP profile: ${report.resolvedConfigPath}\n`, io);
  writeStdout(`Active profile: ${report.activeProfile}\n`, io);
  writeStdout(`Policy: ${report.policy}\n`, io);
  writeStdout(
    `Mutation enabled: ${report.mutationEnabled ? "yes" : "no"}\n`,
    io,
  );
  writeStdout(
    `Audit events: ${report.auditSummary.totalEvents} (allowed ${report.auditSummary.allowedCount}, denied ${report.auditSummary.deniedCount})\n`,
    io,
  );
  writeStdout(
    `Tool catalog: v${report.toolCatalogVersion}, ${report.toolCatalogSummary.totalTools} tools (${report.toolCatalogSummary.byStability.STABLE} stable, ${report.toolCatalogSummary.byStability.BETA} beta, ${report.toolCatalogSummary.byStability.EXPERIMENTAL} experimental, ${report.toolCatalogSummary.byStability.INTERNAL} internal)\n`,
    io,
  );
  const policyEntries = Object.entries(report.auditSummary.byPolicyName).sort(
    (left, right) => right[1] - left[1] || left[0].localeCompare(right[0]),
  );
  writeStdout(`Recent policy trends:\n`, io);
  if (policyEntries.length === 0) {
    writeStdout(`  - (no audit events)\n`, io);
  } else {
    for (const [policyName, count] of policyEntries) {
      writeStdout(`  - ${policyName}: ${count}\n`, io);
    }
  }
  writeStdout(`Recent trace IDs:\n`, io);
  if (report.auditSummary.recentTraceIds.length === 0) {
    writeStdout(`  - (none)\n`, io);
  } else {
    for (const traceId of report.auditSummary.recentTraceIds) {
      writeStdout(`  - ${traceId}\n`, io);
    }
  }
  writeStdout(`\nfiles.include:\n`, io);
  if (report.filesInclude.length === 0) {
    writeStdout(`  - (empty)\n`, io);
  } else {
    for (const pattern of report.filesInclude) {
      writeStdout(`  - ${pattern}\n`, io);
    }
  }
  writeStdout(`\nfiles.exclude:\n`, io);
  for (const pattern of report.filesExclude) {
    writeStdout(`  - ${pattern}\n`, io);
  }
  writeStdout(`\nsections:\n`, io);
  for (const name of report.sectionNames) {
    writeStdout(`  - ${name}\n`, io);
  }
  writeStdout(`\ntool catalog:\n`, io);
  for (const tool of report.toolCatalog) {
    writeStdout(
      `  - ${tool.name}: ${tool.capability}, ${tool.stability}\n`,
      io,
    );
  }
}
