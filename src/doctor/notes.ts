import path from "node:path";

import { loadCxConfig } from "../config/load.js";
import {
  collectNoteCodePathWarnings,
  type NoteCodePathWarning,
} from "../notes/consistency.js";
import { validateNotes } from "../notes/validate.js";
import { buildMasterList } from "../planning/masterList.js";
import { getSectionEntries } from "../planning/overlaps.js";
import { writeJson } from "../shared/output.js";
import { getVCSState } from "../vcs/provider.js";

export interface DoctorNotesArgs {
  config?: string | undefined;
  json?: boolean | undefined;
}

export interface DoctorNotesReport {
  resolvedConfigPath: string;
  sourceRoot: string;
  totalNotes: number;
  masterFileCount: number;
  driftCount: number;
  missingCount: number;
  outsideMasterListCount: number;
  excludedFromPlanCount: number;
  drifts: NoteCodePathWarning[];
}

export interface DoctorNotesDeps {
  loadConfig?: typeof loadCxConfig;
  getState?: typeof getVCSState;
  getMasterList?: typeof buildMasterList;
  validate?: typeof validateNotes;
  collectWarnings?: typeof collectNoteCodePathWarnings;
}

export async function collectDoctorNotesReport(
  args: DoctorNotesArgs,
  deps: DoctorNotesDeps = {},
): Promise<DoctorNotesReport> {
  const loadConfig = deps.loadConfig ?? loadCxConfig;
  const getState = deps.getState ?? getVCSState;
  const getMasterList = deps.getMasterList ?? buildMasterList;
  const validate = deps.validate ?? validateNotes;
  const collectWarnings = deps.collectWarnings ?? collectNoteCodePathWarnings;

  const resolvedConfigPath = path.resolve(args.config ?? "cx.toml");
  const config = await loadConfig(resolvedConfigPath);
  const vcsState = await getState(config.sourceRoot);
  const masterList = await getMasterList(config, vcsState);
  const validation = await validate("notes", config.sourceRoot);
  const sectionEntries = getSectionEntries(config);
  const drifts = await collectWarnings(
    validation.notes,
    config.sourceRoot,
    masterList,
    sectionEntries,
  );

  return {
    resolvedConfigPath,
    sourceRoot: config.sourceRoot,
    totalNotes: validation.notes.length,
    masterFileCount: masterList.length,
    driftCount: drifts.filter((d) => d.status !== "excluded_from_plan").length,
    missingCount: drifts.filter((drift) => drift.status === "missing").length,
    outsideMasterListCount: drifts.filter(
      (drift) => drift.status === "outside_master_list",
    ).length,
    excludedFromPlanCount: drifts.filter(
      (drift) => drift.status === "excluded_from_plan",
    ).length,
    drifts,
  };
}

export function printDoctorNotesReport(
  report: DoctorNotesReport,
  json: boolean,
): void {
  if (json) {
    writeJson(report);
    return;
  }

  if (report.driftCount === 0) {
    process.stdout.write(
      `No note-to-code drift detected against the master list in ${report.resolvedConfigPath}.\n`,
    );
    process.stdout.write(
      `Checked ${report.totalNotes} note${report.totalNotes === 1 ? "" : "s"} against ${report.masterFileCount} repository-backed path${report.masterFileCount === 1 ? "" : "s"}.\n`,
    );
    return;
  }

  process.stdout.write(
    `Detected ${report.driftCount} note-to-code drift warning${report.driftCount === 1 ? "" : "s"} in ${report.resolvedConfigPath}.\n`,
  );
  process.stdout.write(
    "These references do not resolve against the planning master list derived from VCS and files.include/files.exclude.\n\n",
  );
  for (const drift of report.drifts) {
    const detail =
      drift.status === "missing"
        ? "missing from the repository"
        : drift.status === "outside_master_list"
          ? "present on disk but outside the master list"
          : "tracked by VCS but not claimed by any bundle section";
    process.stdout.write(
      `[${drift.fromNoteId}] ${drift.fromTitle} -> ${drift.path} (${detail})\n`,
    );
  }
}
