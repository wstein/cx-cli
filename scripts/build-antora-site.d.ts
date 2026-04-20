export interface BuildAntoraSiteResult {
  playbook: string;
  siteRoot: string;
  indexPath: string;
}

export declare const DEFAULT_ANTORA_PLAYBOOK = "antora-playbook.yml";
export declare const DEFAULT_ANTORA_SITE_ROOT = "dist/antora";
export declare const DEFAULT_ANTORA_CACHE_DIR = ".antora/cache";

export declare function buildAntoraSite(options?: {
  playbook?: string;
  toDir?: string;
  cacheDir?: string;
}): Promise<BuildAntoraSiteResult>;
