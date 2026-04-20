import { getReferenceAdapterModulePath } from "../adapter/capabilities.js";
import type { AdapterModule } from "../adapter/types.js";
import { CxError } from "../shared/errors.js";

export interface ScannerSourceFile {
  path: string;
  content: string;
}

export interface ScannerFinding {
  type?: string;
  filePath: string;
  messages: string[];
}

export interface ScannerPipeline {
  scanFiles(files: ScannerSourceFile[]): Promise<ScannerFinding[]>;
}

export type ScannerRunner = NonNullable<AdapterModule["runSecurityCheck"]>;

export function createScannerPipelineFromRunner(
  runSecurityCheck: ScannerRunner,
): ScannerPipeline {
  return {
    async scanFiles(files: ScannerSourceFile[]): Promise<ScannerFinding[]> {
      const findings = await runSecurityCheck(files);
      return findings.map((finding) => ({
        ...(finding.type === undefined ? {} : { type: finding.type }),
        filePath: finding.filePath,
        messages: [...finding.messages],
      }));
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
