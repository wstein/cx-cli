import type {
  CxListDisplayConfig,
  CxStyle,
  CxTokenAlgorithm,
} from "../config/types.js";

export interface ManifestSettings {
  globalStyle: CxStyle;
  tokenAlgorithm: CxTokenAlgorithm;
  removeComments: boolean;
  removeEmptyLines: boolean;
  compress: boolean;
  showLineNumbers: boolean;
  includeEmptyDirectories: boolean;
  securityCheck: boolean;
  listDisplay: CxListDisplayConfig;
}

export interface ManifestFileRow {
  path: string;
  kind: "text" | "asset";
  section: string | "-";
  storedIn: "packed" | "copied";
  sha256: string;
  sizeBytes: number;
  mtime: string;
  mediaType: string;
  outputStartLine: number | null;
  outputEndLine: number | null;
}

export interface SectionOutputRecord {
  name: string;
  style: CxStyle;
  outputFile: string;
  outputSha256: string;
  fileCount: number;
}

export interface FileSpanRecord {
  outputStartLine: number;
  outputEndLine: number;
}

export type FileSpanMap = Map<string, FileSpanRecord>;
export type SectionSpanMaps = Map<string, FileSpanMap>;

export interface AssetRecord {
  sourcePath: string;
  storedPath: string;
  sha256: string;
  sizeBytes: number;
  mtime: string;
  mediaType: string;
}

/** A section as stored in the manifest, including its file list. */
export interface CxSection extends SectionOutputRecord {
  files: ManifestFileRow[];
}

export interface CxManifest {
  schemaVersion: 2;
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
  sections: CxSection[];
  assets: AssetRecord[];
  /** Flat list of all file rows (text + asset), reconstructed after parsing. */
  files: ManifestFileRow[];
}
