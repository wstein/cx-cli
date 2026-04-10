import type { CxStyle } from "../config/types.js";

export interface ManifestSettings {
  globalStyle: CxStyle;
  removeComments: boolean;
  removeEmptyLines: boolean;
  compress: boolean;
  showLineNumbers: boolean;
  includeEmptyDirectories: boolean;
  securityCheck: boolean;
  losslessTextExtraction: boolean;
}

export interface SectionOutputRecord {
  name: string;
  style: CxStyle;
  outputFile: string;
  outputSha256: string;
  fileCount: number;
}

export interface AssetRecord {
  sourcePath: string;
  storedPath: string;
  sha256: string;
  sizeBytes: number;
  mediaType: string;
}

export interface ManifestFileRow {
  path: string;
  kind: "text" | "asset";
  section: string | "-";
  storedIn: "packed" | "copied";
  sha256: string;
  sizeBytes: number;
  mediaType: string;
  outputFile: string | "-";
  outputStartLine: number | "-";
  outputEndLine: number | "-";
  leadingWhitespaceBase64: string | "-";
  trailingWhitespaceBase64: string | "-";
  exactContentBase64: string | "-";
}

export interface CxManifest {
  schemaVersion: 1;
  bundleVersion: 1;
  projectName: string;
  sourceRoot: string;
  bundleDir: string;
  checksumFile: string;
  createdAt: string;
  cxVersion: string;
  repomixVersion: string;
  checksumAlgorithm: "sha256";
  settings: ManifestSettings;
  sections: SectionOutputRecord[];
  assets: AssetRecord[];
  files: ManifestFileRow[];
}
