import path from "node:path";

import { loadCxConfig } from "../config/load.js";
import { resolveMcpConfigPath } from "../mcp/config.js";
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
}

export interface DoctorMcpDeps {
  loadConfig?: typeof loadCxConfig;
  resolveProfilePath?: typeof resolveMcpConfigPath;
}

export async function collectDoctorMcpReport(
  args: DoctorMcpArgs,
  deps: DoctorMcpDeps = {},
): Promise<DoctorMcpReport> {
  const loadConfig = deps.loadConfig ?? loadCxConfig;
  const resolveProfilePath = deps.resolveProfilePath ?? resolveMcpConfigPath;
  const baseConfigPath = path.resolve(args.config ?? "cx.toml");
  const resolvedConfigPath = await resolveProfilePath(
    path.dirname(baseConfigPath),
  );
  const config = await loadConfig(resolvedConfigPath);

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
}
