import fs from "node:fs/promises";
import path from "node:path";

import { getReferenceAdapterModulePath } from "../adapter/capabilities.js";
import type { AdapterModule, SuspiciousFileResult } from "../adapter/types.js";
import { loadCxConfig } from "../config/load.js";
import { buildMasterList } from "../planning/masterList.js";
import { CxError } from "../shared/errors.js";
import { type CommandIo, writeJson, writeStdout } from "../shared/output.js";
import { getVCSState } from "../vcs/provider.js";

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
  runScan?: (
    files: Array<{ path: string; content: string }>,
  ) => Promise<SuspiciousFileResult[]>;
  readFile?: typeof fs.readFile;
}

async function loadSecurityScanner(): Promise<
  NonNullable<AdapterModule["runSecurityCheck"]>
> {
  const adapterPath = getReferenceAdapterModulePath();
  const adapter = (await import(adapterPath)) as AdapterModule;

  if (typeof adapter.runSecurityCheck !== "function") {
    throw new CxError(
      `${adapterPath} does not export runSecurityCheck(); install the reference oracle to use doctor secrets.`,
      5,
    );
  }

  return adapter.runSecurityCheck;
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
  const runScan = deps.runScan ?? (await loadSecurityScanner());
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
  for (const result of report.suspiciousFiles) {
    writeStdout(`${result.filePath}\n`, io);
    for (const message of result.messages) {
      writeStdout(`  - ${message}\n`, io);
    }
  }
}
