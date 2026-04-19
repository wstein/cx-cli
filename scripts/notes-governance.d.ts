type ExecaOptions = {
  cwd?: string;
  stdio?: "inherit";
  env?: NodeJS.ProcessEnv;
};

type ExecaLike = (
  command: string,
  args: string[],
  options: ExecaOptions,
) => Promise<unknown>;

export type NotesGovernanceInvocation = {
  command: string;
  args: string[];
  cwd: string;
};

export type RunNotesGovernanceOptions = {
  execaImpl?: ExecaLike;
  baseEnv?: NodeJS.ProcessEnv;
  log?: (message: string) => void;
  invocation?: NotesGovernanceInvocation;
};

export type RunNotesGovernanceEntryOptions = {
  runCheck?: () => Promise<void>;
  logError?: (message: string) => void;
  exit?: (code: number) => void;
};

export function createNotesGovernanceInvocation(
  cwd?: string,
): NotesGovernanceInvocation;

export function runNotesGovernance(
  cwd?: string,
  options?: RunNotesGovernanceOptions,
): Promise<void>;

export function runNotesGovernanceEntry(
  options?: RunNotesGovernanceEntryOptions,
): Promise<void>;
