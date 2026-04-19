import path from "node:path";

import { loadCxConfig } from "../../config/load.js";
import { collectAuditSummary } from "../../mcp/audit.js";
import { CxError } from "../../shared/errors.js";
import { pathExists } from "../../shared/fs.js";
import {
  type CommandIo,
  resolveCommandIo,
  writeStdout,
  writeValidatedJson,
} from "../../shared/output.js";
import { AuditSummaryCommandJsonSchema } from "../jsonContracts.js";

export interface AuditArgs {
  subcommand?: "summary" | undefined;
  config?: string | undefined;
  workspaceRoot?: string | undefined;
  json?: boolean | undefined;
}

export interface AuditDeps {
  loadConfig?: typeof loadCxConfig;
  configExists?: (filePath: string) => Promise<boolean>;
  readAuditSummary?: typeof collectAuditSummary;
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
  byPolicyName: Record<string, number>;
  recentTraceIds: string[];
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

  writeStdout(`Recent trace IDs:\n`, io);
  if (payload.recentTraceIds.length === 0) {
    writeStdout(`  - (none)\n`, io);
    return;
  }

  for (const traceId of payload.recentTraceIds) {
    writeStdout(`  - ${traceId}\n`, io);
  }
}

export async function runAuditCommand(
  args: AuditArgs,
  ioArg: Partial<CommandIo> = {},
  deps: AuditDeps = {},
): Promise<number> {
  const io = resolveCommandIo(ioArg);
  const subcommand = args.subcommand ?? "summary";

  if (subcommand !== "summary") {
    throw new CxError(`Unknown audit subcommand: ${subcommand}`, 2);
  }

  const workspaceRoot = await resolveWorkspaceRoot(args, io, deps);
  const readAuditSummary = deps.readAuditSummary ?? collectAuditSummary;
  const summary = await readAuditSummary(workspaceRoot);
  const payload: AuditSummaryPayload = {
    command: "audit summary",
    workspaceRoot,
    auditLogPath: path.join(workspaceRoot, ".cx", "audit.log"),
    ...summary,
  };

  if (args.json ?? false) {
    writeValidatedJson(AuditSummaryCommandJsonSchema, payload, io);
  } else {
    printAuditSummary(payload, io);
  }

  return 0;
}
