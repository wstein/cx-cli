import path from "node:path";

import { loadCxConfig } from "../../config/load.js";
import {
  type AuditLogEvent,
  type AuditRedactionRule,
  collectAuditSummary,
  collectRecentAuditEvents,
} from "../../mcp/audit.js";
import { CxError } from "../../shared/errors.js";
import { pathExists } from "../../shared/fs.js";
import {
  type CommandIo,
  resolveCommandIo,
  writeJson,
  writeStdout,
  writeValidatedJson,
} from "../../shared/output.js";
import {
  AuditRecentCommandJsonSchema,
  AuditSummaryCommandJsonSchema,
} from "../jsonContracts.js";

export interface AuditArgs {
  subcommand?: "recent" | "summary" | undefined;
  config?: string | undefined;
  workspaceRoot?: string | undefined;
  json?: boolean | undefined;
  limit?: number | undefined;
}

export interface AuditDeps {
  loadConfig?: typeof loadCxConfig;
  configExists?: (filePath: string) => Promise<boolean>;
  readAuditSummary?: typeof collectAuditSummary;
  readRecentAuditEvents?: typeof collectRecentAuditEvents;
}

interface AuditSummaryPayload {
  command: "audit summary";
  workspaceRoot: string;
  auditLogPath: string;
  totalEvents: number;
  allowedCount: number;
  deniedCount: number;
  byCapability: {
    read: number;
    observe: number;
    plan: number;
    mutate: number;
  };
  byExecutionStatus: {
    denied: number;
    failed: number;
    succeeded: number;
    timed_out: number;
  };
  byPolicyName: Record<string, number>;
  byRedactionRule: Record<AuditRedactionRule, number>;
  recentTraceIds: string[];
}

interface AuditRecentPayload {
  command: "audit recent";
  workspaceRoot: string;
  auditLogPath: string;
  limit: number;
  events: AuditLogEvent[];
}

async function resolveWorkspaceRoot(
  args: AuditArgs,
  io: CommandIo,
  deps: AuditDeps,
): Promise<string> {
  if (args.workspaceRoot) {
    return path.resolve(io.cwd, args.workspaceRoot);
  }

  const configPath = path.resolve(io.cwd, args.config ?? "cx.toml");
  const configExists = deps.configExists ?? pathExists;
  if (!(await configExists(configPath))) {
    return io.cwd;
  }

  const loadConfig = deps.loadConfig ?? loadCxConfig;
  const config = await loadConfig(configPath);
  return path.resolve(config.sourceRoot);
}

function printAuditSummary(
  payload: AuditSummaryPayload,
  io: Partial<CommandIo>,
): void {
  writeStdout(`Audit summary: ${payload.auditLogPath}\n`, io);
  writeStdout(
    `Events: ${payload.totalEvents} (allowed ${payload.allowedCount}, denied ${payload.deniedCount})\n`,
    io,
  );
  writeStdout(`By capability:\n`, io);
  for (const [capability, count] of Object.entries(payload.byCapability)) {
    writeStdout(`  - ${capability}: ${count}\n`, io);
  }

  writeStdout(`By execution status:\n`, io);
  for (const [status, count] of Object.entries(payload.byExecutionStatus)) {
    writeStdout(`  - ${status}: ${count}\n`, io);
  }

  writeStdout(`Policy trends:\n`, io);
  const policyEntries = Object.entries(payload.byPolicyName).sort(
    (left, right) => right[1] - left[1] || left[0].localeCompare(right[0]),
  );
  if (policyEntries.length === 0) {
    writeStdout(`  - (no audit events)\n`, io);
  } else {
    for (const [policyName, count] of policyEntries) {
      writeStdout(`  - ${policyName}: ${count}\n`, io);
    }
  }

  writeStdout(`Redaction rules:\n`, io);
  const redactionEntries = Object.entries(payload.byRedactionRule).sort(
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
  if (payload.recentTraceIds.length === 0) {
    writeStdout(`  - (none)\n`, io);
    return;
  }

  for (const traceId of payload.recentTraceIds) {
    writeStdout(`  - ${traceId}\n`, io);
  }
}

function printAuditRecent(
  payload: AuditRecentPayload,
  io: Partial<CommandIo>,
): void {
  writeStdout(`Recent audit events: ${payload.auditLogPath}\n`, io);
  writeStdout(`Limit: ${payload.limit}\n`, io);
  if (payload.events.length === 0) {
    writeStdout(`  - (no audit events)\n`, io);
    return;
  }

  for (const event of payload.events) {
    writeStdout(
      `- ${event.traceId} | ${event.tool} | ${event.decision}/${event.execution.status}\n`,
      io,
    );
    writeStdout(
      `  session=${event.sessionId} request=${event.requestId} capability=${event.capability}\n`,
      io,
    );
    writeStdout(`  policy=${event.policyName}\n`, io);
    writeStdout(`  reason=${event.request.agentReason}\n`, io);
    if (event.request.userGoal) {
      writeStdout(`  goal=${event.request.userGoal}\n`, io);
    }
    if (event.path) {
      writeStdout(`  path=${event.path}\n`, io);
    }
    if (event.execution.durationMs !== undefined) {
      writeStdout(`  durationMs=${event.execution.durationMs}\n`, io);
    }
    if (event.execution.error) {
      writeStdout(`  error=${event.execution.error}\n`, io);
    }
    if (event.request.redaction.applied) {
      writeStdout(
        `  redaction=${event.request.redaction.rules.join(", ")}\n`,
        io,
      );
    }
    writeJson(event.request.args, io);
  }
}

export async function runAuditCommand(
  args: AuditArgs,
  ioArg: Partial<CommandIo> = {},
  deps: AuditDeps = {},
): Promise<number> {
  const io = resolveCommandIo(ioArg);
  const subcommand = args.subcommand ?? "summary";

  if (subcommand !== "summary" && subcommand !== "recent") {
    throw new CxError(`Unknown audit subcommand: ${subcommand}`, 2);
  }

  const workspaceRoot = await resolveWorkspaceRoot(args, io, deps);
  const auditLogPath = path.join(workspaceRoot, ".cx", "audit.log");

  if (subcommand === "summary") {
    const readAuditSummary = deps.readAuditSummary ?? collectAuditSummary;
    const summary = await readAuditSummary(workspaceRoot);
    const payload: AuditSummaryPayload = {
      command: "audit summary",
      workspaceRoot,
      auditLogPath,
      ...summary,
    };

    if (args.json ?? false) {
      writeValidatedJson(AuditSummaryCommandJsonSchema, payload, io);
    } else {
      printAuditSummary(payload, io);
    }

    return 0;
  }

  const readRecentAuditEvents =
    deps.readRecentAuditEvents ?? collectRecentAuditEvents;
  const recentEvents = await readRecentAuditEvents(
    workspaceRoot,
    args.limit ?? 10,
  );
  const payload: AuditRecentPayload = {
    command: "audit recent",
    workspaceRoot,
    auditLogPath,
    ...recentEvents,
  };

  if (args.json ?? false) {
    writeValidatedJson(AuditRecentCommandJsonSchema, payload, io);
  } else {
    printAuditRecent(payload, io);
  }

  return 0;
}
