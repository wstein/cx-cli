import fs from "node:fs/promises";
import path from "node:path";

import { runSecurityCheck, type SuspiciousFileResult } from "@wsmy/repomix-cx-fork";

import { loadCxConfig } from "../../config/load.js";
import { buildMasterList } from "../../planning/overlaps.js";
import { writeJson } from "../../shared/output.js";
import { getVCSState } from "../../vcs/provider.js";

export interface DoctorSecretsArgs {
  config?: string | undefined;
  json?: boolean | undefined;
}

export interface DoctorSecretsReport {
  resolvedConfigPath: string;
  securityCheckEnabled: boolean;
  scannedFileCount: number;
  suspiciousCount: number;
  suspiciousFiles: SuspiciousFileResult[];
}

export interface DoctorSecretsDeps {
  loadConfig?: typeof loadCxConfig;
  getMasterList?: typeof buildMasterList;
  getState?: typeof getVCSState;
  runScan?: typeof runSecurityCheck;
  readFile?: typeof fs.readFile;
}

async function collectRawFiles(
  sourceRoot: string,
  filePaths: string[],
  readFile: typeof fs.readFile,
): Promise<Array<{ path: string; content: string }>> {
  const rawFiles: Array<{ path: string; content: string }> = [];

  for (const relativePath of filePaths) {
    const absolutePath = path.join(sourceRoot, relativePath);
    const content = await readFile(absolutePath, "utf8");
    rawFiles.push({
      path: relativePath,
      content,
    });
  }

  return rawFiles;
}

export async function collectDoctorSecretsReport(
  args: DoctorSecretsArgs,
  deps: DoctorSecretsDeps = {},
): Promise<DoctorSecretsReport> {
  const loadConfig = deps.loadConfig ?? loadCxConfig;
  const getMasterList = deps.getMasterList ?? buildMasterList;
  const getState = deps.getState ?? getVCSState;
  const runScan = deps.runScan ?? runSecurityCheck;
  const readFile = deps.readFile ?? fs.readFile;

  const resolvedConfigPath = path.resolve(args.config ?? "cx.toml");
  const config = await loadConfig(resolvedConfigPath);
  const vcsState = await getState(config.sourceRoot);
  const masterList = await getMasterList(config, vcsState);
  const rawFiles = await collectRawFiles(config.sourceRoot, masterList, readFile);
  const suspiciousFiles = await runScan(rawFiles);

  return {
    resolvedConfigPath,
    securityCheckEnabled: config.repomix.securityCheck,
    scannedFileCount: rawFiles.length,
    suspiciousCount: suspiciousFiles.length,
    suspiciousFiles,
  };
}

export function printDoctorSecretsReport(
  report: DoctorSecretsReport,
  json: boolean,
): void {
  if (json) {
    writeJson(report);
    return;
  }

  if (report.suspiciousCount === 0) {
    process.stdout.write(
      `No suspicious files detected in ${report.resolvedConfigPath}.\n`,
    );
    if (!report.securityCheckEnabled) {
      process.stdout.write(
        "repomix.security_check is disabled in cx.toml, but this diagnostic still scanned the master list explicitly.\n",
      );
    }
    return;
  }

  process.stdout.write(
    `Detected ${report.suspiciousCount} suspicious file${report.suspiciousCount === 1 ? "" : "s"} in ${report.resolvedConfigPath}.\n\n`,
  );
  for (const result of report.suspiciousFiles) {
    process.stdout.write(`${result.filePath}\n`);
    for (const message of result.messages) {
      process.stdout.write(`  - ${message}\n`);
    }
  }
}
