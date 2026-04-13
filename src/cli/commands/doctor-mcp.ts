import path from "node:path";

import { loadCxConfig } from "../../config/load.js";
import { resolveMcpConfigPath } from "./mcp.js";
import { writeJson } from "../../shared/output.js";

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
  };
}

export function printDoctorMcpReport(
  report: DoctorMcpReport,
  json: boolean,
): void {
  if (json) {
    writeJson(report);
    return;
  }

  process.stdout.write(`Resolved MCP profile: ${report.resolvedConfigPath}\n`);
  process.stdout.write(`Active profile: ${report.activeProfile}\n`);
  process.stdout.write(`\nfiles.include:\n`);
  if (report.filesInclude.length === 0) {
    process.stdout.write(`  - (empty)\n`);
  } else {
    for (const pattern of report.filesInclude) {
      process.stdout.write(`  - ${pattern}\n`);
    }
  }
  process.stdout.write(`\nfiles.exclude:\n`);
  for (const pattern of report.filesExclude) {
    process.stdout.write(`  - ${pattern}\n`);
  }
  process.stdout.write(`\nsections:\n`);
  for (const name of report.sectionNames) {
    process.stdout.write(`  - ${name}\n`);
  }
}
