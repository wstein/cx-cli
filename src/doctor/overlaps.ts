import path from "node:path";

import { loadCxConfig } from "../config/load.js";
import {
  analyzeSectionOverlaps,
  buildMasterList,
  type OverlapConflict,
} from "../planning/overlaps.js";
import { writeJson } from "../shared/output.js";
import { getVCSState } from "../vcs/provider.js";

export interface DoctorOverlapsArgs {
  config?: string | undefined;
  json?: boolean | undefined;
}

export interface DoctorOverlapsReport {
  resolvedConfigPath: string;
  conflictCount: number;
  conflicts: OverlapConflict[];
}

export interface DoctorOverlapsDeps {
  loadConfig?: typeof loadCxConfig;
  getState?: typeof getVCSState;
  getMasterList?: typeof buildMasterList;
  analyzeOverlaps?: typeof analyzeSectionOverlaps;
}

export async function collectDoctorOverlapsReport(
  args: DoctorOverlapsArgs,
  deps: DoctorOverlapsDeps = {},
): Promise<DoctorOverlapsReport> {
  const loadConfig = deps.loadConfig ?? loadCxConfig;
  const getState = deps.getState ?? getVCSState;
  const getMasterList = deps.getMasterList ?? buildMasterList;
  const analyzeOverlaps = deps.analyzeOverlaps ?? analyzeSectionOverlaps;
  const resolvedConfigPath = path.resolve(args.config ?? "cx.toml");
  const config = await loadConfig(resolvedConfigPath);
  const vcsState = await getState(config.sourceRoot);
  const masterList = await getMasterList(config, vcsState);
  const conflicts = await analyzeOverlaps(config, masterList);

  return {
    resolvedConfigPath,
    conflictCount: conflicts.length,
    conflicts,
  };
}

export function printDoctorOverlapsReport(
  report: DoctorOverlapsReport,
  json: boolean,
): void {
  if (json) {
    writeJson(report);
    return;
  }

  if (report.conflictCount === 0) {
    process.stdout.write(
      `No section overlaps detected in ${report.resolvedConfigPath}.\n`,
    );
    return;
  }

  process.stdout.write(
    `Detected ${report.conflictCount} section overlap${report.conflictCount === 1 ? "" : "s"} in ${report.resolvedConfigPath}.\n\n`,
  );
  for (const conflict of report.conflicts) {
    process.stdout.write(`${formatConflictSummary(conflict)}\n\n`);
  }
  process.stdout.write(
    "Run `cx doctor fix-overlaps --dry-run` to review the proposed exclude updates.\n",
  );
}

function formatConflictSummary(conflict: OverlapConflict): string {
  const lines = [
    `${conflict.path}`,
    `  matching sections: ${conflict.sections.join(", ")}`,
    `  owner: ${conflict.recommendedOwner}`,
  ];

  const affectedSections = conflict.sections.filter(
    (section) => section !== conflict.recommendedOwner,
  );
  if (affectedSections.length > 0) {
    lines.push(`  exclude from: ${affectedSections.join(", ")}`);
  }

  return lines.join("\n");
}
