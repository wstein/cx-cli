import type { CxStyle } from "../config/types.js";

export interface PlannedSourceFile {
  relativePath: string;
  absolutePath: string;
  kind: "text" | "asset";
  mediaType: string;
  sizeBytes: number;
  sha256: string;
  mtime: string;
}

export interface PlannedSection {
  name: string;
  style: CxStyle;
  outputFile: string;
  files: PlannedSourceFile[];
}

export interface PlannedAsset extends PlannedSourceFile {
  storedPath: string;
}

export interface BundlePlan {
  projectName: string;
  sourceRoot: string;
  bundleDir: string;
  checksumFile: string;
  sections: PlannedSection[];
  assets: PlannedAsset[];
  unmatchedFiles: string[];
}
