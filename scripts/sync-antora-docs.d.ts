export interface SyncAntoraDocsResult {
  pageCount: number;
  pagesRoot: string;
  navPartialPath: string;
}

export declare const DEFAULT_REPO_ROOT: string;
export declare const DEFAULT_ANTORA_ROOT = "docs/antora";
export declare const DEFAULT_ANTORA_PAGES_ROOT: string;
export declare const DEFAULT_ANTORA_NAV_PARTIAL: string;
export declare const REPOSITORY_BLOB_BASE =
  "https://github.com/wstein/cx-cli/blob/main/";

export declare function syncAntoraDocs(options?: {
  repoRoot?: string;
  pagesRoot?: string;
  navPartialPath?: string;
  lockDir?: string;
}): Promise<SyncAntoraDocsResult>;
