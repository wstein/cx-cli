export type AgainstDirVerifyTest = {
  relativePath: string;
  testName: string;
  line: number;
  reason: string | undefined;
};

export type AgainstDirVerifyReport = {
  schemaVersion: number;
  generatedAt: string;
  ok: boolean;
  summary: {
    againstDirTestCount: number;
    missingJustificationCount: number;
  };
  entries: Array<
    AgainstDirVerifyTest & {
      hasJustification: boolean;
    }
  >;
  missingJustifications: string[];
};

export const VERIFY_AGAINST_TAG_PREFIX: string;
export const VERIFY_AGAINST_REPORT_SCHEMA_VERSION: number;

export function collectAgainstDirVerifyTests(
  rootDir?: string,
): AgainstDirVerifyTest[];

export function validateAgainstDirVerifyPolicy(rootDir?: string): {
  entries: AgainstDirVerifyTest[];
  missingJustifications: string[];
};

export function buildAgainstDirVerifyReport(
  rootDir?: string,
): AgainstDirVerifyReport;

export function renderAgainstDirVerifyReport(
  report: AgainstDirVerifyReport,
  format?: "text" | "json",
): string;

export function runVerifyAgainstPolicyCli(
  args?: string[],
  io?: {
    stdout: (message: string) => void;
    stderr: (message: string) => void;
  },
): number;
