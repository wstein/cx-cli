import path from "node:path";
import type {
  CxManifest,
  DerivedReviewExportRecord,
} from "../manifest/types.js";
import { pathExists } from "../shared/fs.js";
import { sha256File } from "../shared/hashing.js";

export interface DerivedReviewExportIntegrity {
  status: "intact" | "blocked";
  reason: "intact" | "missing_artifact" | "hash_mismatch";
  message: string;
  expectedSha256?: string;
  actualSha256?: string;
}

export interface DerivedReviewExportWithIntegrity {
  artifact: DerivedReviewExportRecord;
  integrity: DerivedReviewExportIntegrity;
}

export interface DerivedReviewExportIntegritySummary {
  totalCount: number;
  intactCount: number;
  blockedCount: number;
  files: Array<{
    storedPath: string;
    status: "intact" | "blocked";
    reason: "intact" | "missing_artifact" | "hash_mismatch";
  }>;
}

export async function resolveDerivedReviewExportIntegrity(params: {
  bundleDir: string;
  manifest: CxManifest;
}): Promise<DerivedReviewExportWithIntegrity[]> {
  return Promise.all(
    (params.manifest.derivedReviewExports ?? []).map(async (artifact) => {
      const artifactPath = path.join(params.bundleDir, artifact.storedPath);
      if (!(await pathExists(artifactPath))) {
        return {
          artifact,
          integrity: {
            status: "blocked",
            reason: "missing_artifact",
            message: `Bundle is missing derived review export ${artifact.storedPath}.`,
            expectedSha256: artifact.sha256,
          },
        };
      }

      const actualSha256 = await sha256File(artifactPath);
      if (actualSha256 !== artifact.sha256) {
        return {
          artifact,
          integrity: {
            status: "blocked",
            reason: "hash_mismatch",
            message: `Derived review export ${artifact.storedPath} does not match its recorded checksum.`,
            expectedSha256: artifact.sha256,
            actualSha256,
          },
        };
      }

      return {
        artifact,
        integrity: {
          status: "intact",
          reason: "intact",
          message: `Derived review export ${artifact.storedPath} matches the manifest checksum.`,
          expectedSha256: artifact.sha256,
          actualSha256,
        },
      };
    }),
  );
}

export function summarizeDerivedReviewExportIntegrity(
  records: DerivedReviewExportWithIntegrity[],
): DerivedReviewExportIntegritySummary {
  const summary: DerivedReviewExportIntegritySummary = {
    totalCount: records.length,
    intactCount: 0,
    blockedCount: 0,
    files: [],
  };

  for (const record of records) {
    if (record.integrity.status === "intact") {
      summary.intactCount += 1;
    } else {
      summary.blockedCount += 1;
    }
    summary.files.push({
      storedPath: record.artifact.storedPath,
      status: record.integrity.status,
      reason: record.integrity.reason,
    });
  }

  return summary;
}
