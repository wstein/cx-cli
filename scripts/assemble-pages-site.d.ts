export const DEFAULT_SITE_ROOT: string;
export const DEFAULT_SCHEMAS_DIR: string;
export const DEFAULT_COVERAGE_DIR: string;

export interface AssemblePagesSiteResult {
  siteRoot: string;
  schemasDir: string;
  schemaNames: string[];
  hasCoverage: boolean;
  coverageDir: string | null;
}

export function assemblePagesSite(options?: {
  siteRoot?: string;
  schemasDir?: string;
  coverageDir?: string;
}): Promise<AssemblePagesSiteResult>;
