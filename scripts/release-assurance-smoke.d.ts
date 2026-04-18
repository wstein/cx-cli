export function createReleaseAssurancePaths(cwd?: string): {
  tarballDir: string;
  releaseIntegrityPath: string;
  npmCacheDir: string;
};

export function createNpmPackEnv(
  tarballDir: string,
  baseEnv?: NodeJS.ProcessEnv,
): NodeJS.ProcessEnv & {
  npm_config_cache: string;
};

export function runReleaseAssuranceSmoke(cwd?: string): Promise<void>;
