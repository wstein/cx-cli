export interface AssemblePagesSiteResult {
  siteRoot: string;
  schemasDir: string;
  schemaNames: string[];
  hasCoverage: boolean;
  coverageDir: string | null;
  docsDir: string;
}

export declare const DEFAULT_SITE_ROOT = "dist/site";
export declare const DEFAULT_SCHEMAS_DIR = "schemas";
export declare const DEFAULT_COVERAGE_DIR = "coverage/vitest";
export declare const DEFAULT_DOCS_DIR = "dist/antora";

export declare function assemblePagesSite(options?: {
  siteRoot?: string;
  schemasDir?: string;
  coverageDir?: string;
  docsBuildDir?: string;
  antoraPlaybook?: string;
}): Promise<AssemblePagesSiteResult>;
