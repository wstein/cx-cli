import path from "node:path";

import { loadCxConfig } from "../config/load.js";
import { type AuditSummary, collectAuditSummary } from "../mcp/audit.js";
import { resolveMcpConfigPath } from "../mcp/config.js";
import {
  CX_MCP_TOOL_CATALOG_VERSION,
  type CxMcpToolCatalogEntry,
  type CxMcpToolCatalogSummary,
  getCxMcpToolCatalog,
  summarizeCxMcpToolCatalog,
} from "../mcp/tools/catalog.js";
import { type CommandIo, writeJson, writeStdout } from "../shared/output.js";

export interface DoctorMcpArgs {
  config?: string | undefined;
  json?: boolean | undefined;
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
  toolCatalogVersion: typeof CX_MCP_TOOL_CATALOG_VERSION;
  toolCatalog: CxMcpToolCatalogEntry[];
  toolCatalogSummary: CxMcpToolCatalogSummary;
}

export interface DoctorMcpDeps {
  loadConfig?: typeof loadCxConfig;
  resolveProfilePath?: typeof resolveMcpConfigPath;
  readAuditSummary?: typeof collectAuditSummary;
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
  const toolCatalog = getCxMcpToolCatalog();

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
    toolCatalogVersion: CX_MCP_TOOL_CATALOG_VERSION,
    toolCatalog,
    toolCatalogSummary: summarizeCxMcpToolCatalog(toolCatalog),
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
  writeStdout(`Audit execution:\n`, io);
  for (const [status, count] of Object.entries(
    report.auditSummary.byExecutionStatus,
  )) {
    writeStdout(`  - ${status}: ${count}\n`, io);
  }
  writeStdout(`Agent reason coverage:\n`, io);
  for (const [bucket, count] of Object.entries(
    report.auditSummary.byAgentReasonPresence,
  )) {
    writeStdout(`  - ${bucket}: ${count}\n`, io);
  }
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
  writeStdout(`Recent redaction rules:\n`, io);
  const redactionEntries = Object.entries(
    report.auditSummary.byRedactionRule,
  ).sort(
    (left, right) => right[1] - left[1] || left[0].localeCompare(right[0]),
  );
  if (redactionEntries.every(([, count]) => count === 0)) {
    writeStdout(`  - (none)\n`, io);
  } else {
    for (const [rule, count] of redactionEntries) {
      writeStdout(`  - ${rule}: ${count}\n`, io);
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
