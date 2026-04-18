type ExecaResult = { stdout: string };
type ExecaOptions = {
  stdio?: "inherit";
  stdin?: "ignore";
  stdout?: "pipe";
  stderr?: "inherit";
  env?: NodeJS.ProcessEnv;
};

type ExecaLike = (
  command: string,
  args: string[],
  options: ExecaOptions,
) => Promise<undefined | ExecaResult>;

export type ReleaseAssuranceSmokeOptions = {
  fsImpl?: {
    rm(
      path: string,
      options: { recursive?: boolean; force?: boolean },
    ): Promise<void>;
    mkdir(path: string, options: { recursive?: boolean }): Promise<void>;
  };
  baseEnv?: NodeJS.ProcessEnv;
  runImpl?: (
    command: string,
    args: string[],
    envOverrides?: NodeJS.ProcessEnv,
    options?: { baseEnv?: NodeJS.ProcessEnv; execaImpl?: ExecaLike },
  ) => Promise<void>;
  runJsonImpl?: (
    command: string,
    args: string[],
    envOverrides?: NodeJS.ProcessEnv,
    options?: { baseEnv?: NodeJS.ProcessEnv; execaImpl?: ExecaLike },
  ) => Promise<string>;
  parseJson?: (json: string) => unknown;
  log?: (message: string) => void;
  execPath?: string;
};

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

export function runCommand(
  command: string,
  args: string[],
  envOverrides?: NodeJS.ProcessEnv,
  options?: { execaImpl?: ExecaLike; baseEnv?: NodeJS.ProcessEnv },
): Promise<void>;

export function runJsonCommand(
  command: string,
  args: string[],
  envOverrides?: NodeJS.ProcessEnv,
  options?: { execaImpl?: ExecaLike; baseEnv?: NodeJS.ProcessEnv },
): Promise<string>;

export function runReleaseAssuranceSmoke(
  cwd?: string,
  options?: ReleaseAssuranceSmokeOptions,
): Promise<void>;
