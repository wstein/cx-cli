export type CxStyle = 'xml' | 'markdown' | 'json' | 'plain';
export type CxDedupMode = 'fail' | 'first-wins';
export type CxUnmatchedMode = 'ignore' | 'fail';
export type CxAssetsMode = 'copy' | 'ignore' | 'fail';

export interface CxSectionConfig {
  include: string[];
  exclude: string[];
  style?: CxStyle;
}

export interface CxRepomixConfig {
  style: CxStyle;
  compress: boolean;
  removeComments: boolean;
  removeEmptyLines: boolean;
  showLineNumbers: boolean;
  includeEmptyDirectories: boolean;
  securityCheck: boolean;
}

export interface CxFilesConfig {
  exclude: string[];
  followSymlinks: boolean;
  unmatched: CxUnmatchedMode;
}

export interface CxDedupConfig {
  mode: CxDedupMode;
  order: 'config' | 'lexical';
}

export interface CxManifestConfig {
  format: 'toon';
  includeFileSha256: boolean;
  includeOutputSha256: boolean;
  includeOutputSpans: boolean;
  includeSourceMetadata: boolean;
}

export interface CxChecksumsConfig {
  algorithm: 'sha256';
  fileName: string;
}

export interface CxAssetsConfig {
  include: string[];
  exclude: string[];
  mode: CxAssetsMode;
  targetDir: string;
}

export interface CxConfig {
  schemaVersion: 1;
  projectName: string;
  sourceRoot: string;
  outputDir: string;
  repomix: CxRepomixConfig;
  files: CxFilesConfig;
  dedup: CxDedupConfig;
  manifest: CxManifestConfig;
  checksums: CxChecksumsConfig;
  assets: CxAssetsConfig;
  sections: Record<string, CxSectionConfig>;
}

export interface CxConfigInput {
  schema_version?: unknown;
  project_name?: unknown;
  source_root?: unknown;
  output_dir?: unknown;
  repomix?: Record<string, unknown>;
  files?: Record<string, unknown>;
  dedup?: Record<string, unknown>;
  manifest?: Record<string, unknown>;
  checksums?: Record<string, unknown>;
  assets?: Record<string, unknown>;
  sections?: Record<string, Record<string, unknown>>;
}
