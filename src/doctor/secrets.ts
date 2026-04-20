import fs from "node:fs/promises";
import path from "node:path";

import { loadCxConfig } from "../config/load.js";
import { buildMasterList } from "../planning/masterList.js";
import { type CommandIo, writeJson, writeStdout } from "../shared/output.js";
import { getVCSState } from "../vcs/provider.js";
import {
  loadReferenceScannerPipeline,
  type ScannerPipeline,
  type ScannerPipelineReport,
} from "./scanner.js";

export interface DoctorSecretsArgs {
  config?: string | undefined;
  json?: boolean | undefined;
}

export interface DoctorSecretsReport {
  resolvedConfigPath: string;
  securityCheckEnabled: boolean;
  scannerMode: "fail" | "warn";
  scannedFileCount: number;
  suspiciousCount: number;
  findings: ScannerPipelineReport["findings"];
  warningCount: number;
  blockingCount: number;
}

export interface DoctorSecretsDeps {
  loadConfig?: typeof loadCxConfig;
  getMasterList?: typeof buildMasterList;
  getState?: typeof getVCSState;
  scannerPipeline?: ScannerPipeline;
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
  const scannerPipeline =
    deps.scannerPipeline ?? (await loadReferenceScannerPipeline());
  const readFile = deps.readFile ?? fs.readFile;

  const resolvedConfigPath = path.resolve(args.config ?? "cx.toml");
  const config = await loadConfig(resolvedConfigPath);
  const vcsState = await getState(config.sourceRoot);
  const masterList = await getMasterList(config, vcsState);
  const rawFiles = await collectRawFiles(
    config.sourceRoot,
    masterList,
    readFile,
  );
  const scanReport = await scannerPipeline.scanStage(
    "pre_pack_source",
    rawFiles,
    {
      mode: config.scanner.mode,
      enabledScannerIds: config.scanner.ids,
    },
  );

  return {
    resolvedConfigPath,
    securityCheckEnabled: config.repomix.securityCheck,
    scannerMode: config.scanner.mode,
    scannedFileCount: rawFiles.length,
    suspiciousCount: scanReport.findings.length,
    findings: scanReport.findings,
    warningCount: scanReport.warningCount,
    blockingCount: scanReport.blockingCount,
  };
}

export function printDoctorSecretsReport(
  report: DoctorSecretsReport,
  json: boolean,
  io: Partial<CommandIo> = {},
): void {
  if (json) {
    writeJson(report, io);
    return;
  }

  if (report.suspiciousCount === 0) {
    writeStdout(
      `No suspicious files detected in ${report.resolvedConfigPath}.\n`,
      io,
    );
    if (!report.securityCheckEnabled) {
      writeStdout(
        "repomix.security_check is disabled in cx.toml, but this diagnostic still scanned the master list explicitly.\n",
        io,
      );
    }
    return;
  }

  writeStdout(
    `Detected ${report.suspiciousCount} suspicious file${report.suspiciousCount === 1 ? "" : "s"} in ${report.resolvedConfigPath}.\n\n`,
    io,
  );
  for (const result of report.findings) {
    writeStdout(
      `${result.filePath} (${result.scannerId}, ${result.severity})\n`,
      io,
    );
    for (const message of result.messages) {
      writeStdout(`  - ${message}\n`, io);
    }
  }
}
