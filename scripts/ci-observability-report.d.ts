export const CI_OBSERVABILITY_SCHEMA_VERSION: number;
export const DEFAULT_FAST_LANE_STATE_PATH: string;
export const DEFAULT_VERIFY_AGAINST_REPORT_PATH: string;
export const DEFAULT_OBSERVABILITY_JSON_PATH: string;
export const DEFAULT_OBSERVABILITY_MD_PATH: string;

export type FastLaneSample = {
  timestamp?: string;
  durationMs: number;
  warning?: boolean;
  failureSignal?: boolean;
};

export type FastLaneState = {
  lastDurationMs?: number;
  failureStreak?: number;
  samples: FastLaneSample[];
};

export type VerifyAgainstReportSummary = {
  againstDirTestCount?: number;
  missingJustificationCount?: number;
};

export type VerifyAgainstReport = {
  ok?: boolean;
  summary?: VerifyAgainstReportSummary;
};

export type CiObservabilityReport = {
  schemaVersion: number;
  generatedAt: string;
  fastLane:
    | {
        available: false;
      }
    | {
        available: true;
        lastDurationMs?: number;
        lastDurationText: string;
        failureStreak: number;
        sampleCount: number;
        trend: "improving" | "stable" | "regressing" | "insufficient-data";
        warningSampleCount: number;
        failureSignalCount: number;
        recentSamples: Array<{
          timestamp?: string;
          durationMs: number;
          durationText: string;
          warning: boolean;
          failureSignal: boolean;
        }>;
      };
  verifyAgainst:
    | {
        available: false;
      }
    | {
        available: true;
        ok: boolean;
        againstDirTestCount: number;
        missingJustificationCount: number;
      };
};

export function classifyFastLaneTrend(
  samples: FastLaneSample[],
): "improving" | "stable" | "regressing" | "insufficient-data";

export function buildCiObservabilityReport(params: {
  fastLaneState?: FastLaneState;
  verifyAgainstReport?: VerifyAgainstReport;
  nowIso?: string;
}): CiObservabilityReport;

export function renderCiObservabilityMarkdown(
  report: CiObservabilityReport,
): string;

export function generateCiObservabilityReport(options?: {
  rootDir?: string;
  nowIso?: string;
}): Promise<CiObservabilityReport>;

export function runCiObservabilityReportCli(
  args?: string[],
  io?: {
    stdout: (message: string) => void;
    stderr: (message: string) => void;
  },
): Promise<number>;
