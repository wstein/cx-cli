import { getReferenceAdapterModulePath } from "../adapter/capabilities.js";
import type { AdapterModule } from "../adapter/types.js";
import { CxError } from "../shared/errors.js";

export type ScannerSeverity = "warning" | "error";
export type ScannerStage = "pre_pack_source" | "post_pack_artifact";
export type ScannerProfile = "core";
export type ScannerMode = "fail" | "warn";
export type ScannerId = "reference_secrets";

export interface ScannerInputFile {
  path: string;
  content: string;
}

export interface ScannerFinding {
  scannerId: string;
  profile: ScannerProfile;
  stage: ScannerStage;
  severity: ScannerSeverity;
  blocksProof: boolean;
  type?: string;
  filePath: string;
  messages: string[];
}

export interface ScannerPipelineReport {
  mode: ScannerMode;
  findings: ScannerFinding[];
  warningCount: number;
  blockingCount: number;
}

export interface ScannerPipeline {
  scanStage(
    stage: ScannerStage,
    files: ScannerInputFile[],
    options?: {
      mode?: ScannerMode;
      enabledScannerIds?: ScannerId[];
    },
  ): Promise<ScannerPipelineReport>;
}

export type ScannerRunner = NonNullable<AdapterModule["runSecurityCheck"]>;

export function createScannerPipelineFromRunner(
  runSecurityCheck: ScannerRunner,
): ScannerPipeline {
  return {
    async scanStage(
      stage: ScannerStage,
      files: ScannerInputFile[],
      options?: {
        mode?: ScannerMode;
        enabledScannerIds?: ScannerId[];
      },
    ): Promise<ScannerPipelineReport> {
      const mode = options?.mode ?? "warn";
      const enabledScannerIds = new Set(
        options?.enabledScannerIds ?? ["reference_secrets"],
      );

      if (!enabledScannerIds.has("reference_secrets")) {
        return {
          mode,
          findings: [],
          warningCount: 0,
          blockingCount: 0,
        };
      }

      const findings = await runSecurityCheck(files);
      const normalizedFindings = findings.map((finding) => ({
        scannerId: "reference_secrets" as const,
        profile: "core" as const,
        stage,
        severity: mode === "fail" ? ("error" as const) : ("warning" as const),
        blocksProof: mode === "fail",
        ...(finding.type === undefined ? {} : { type: finding.type }),
        filePath: finding.filePath,
        messages: [...finding.messages],
      }));

      return {
        mode,
        findings: normalizedFindings,
        warningCount: normalizedFindings.filter(
          (finding) => finding.severity === "warning",
        ).length,
        blockingCount: normalizedFindings.filter(
          (finding) => finding.blocksProof,
        ).length,
      };
    },
  };
}

export async function loadReferenceScannerPipeline(
  loadModule: () => Promise<AdapterModule> = async () =>
    (await import(getReferenceAdapterModulePath())) as AdapterModule,
): Promise<ScannerPipeline> {
  const adapterPath = getReferenceAdapterModulePath();
  const adapter = await loadModule();

  if (typeof adapter.runSecurityCheck !== "function") {
    throw new CxError(
      `${adapterPath} does not export runSecurityCheck(); install the reference oracle to use doctor secrets.`,
      5,
    );
  }

  return createScannerPipelineFromRunner(adapter.runSecurityCheck);
}
