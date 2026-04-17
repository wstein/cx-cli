export interface CapturedCliResult<T = unknown> {
  exitCode: number;
  stdout: string;
  stderr: string;
  logs: string;
  parsedJson?: T;
}

export async function captureCli<T = unknown>(params: {
  run: () => Promise<number>;
  parseJson?: boolean;
  captureConsoleLog?: boolean;
}): Promise<CapturedCliResult<T>> {
  const stdoutChunks: string[] = [];
  const stderrChunks: string[] = [];
  const logChunks: string[] = [];
  const originalStdoutWrite = process.stdout.write;
  const originalStderrWrite = process.stderr.write;
  const originalConsoleLog = console.log;

  process.stdout.write = ((chunk: string | Uint8Array) => {
    stdoutChunks.push(String(chunk));
    return true;
  }) as typeof process.stdout.write;
  process.stderr.write = ((chunk: string | Uint8Array) => {
    stderrChunks.push(String(chunk));
    return true;
  }) as typeof process.stderr.write;

  if (params.captureConsoleLog === true) {
    console.log = ((...args: unknown[]) => {
      logChunks.push(args.map((value) => String(value)).join(" "));
    }) as typeof console.log;
  }

  try {
    const exitCode = await params.run();
    const stdout = stdoutChunks.join("");
    return {
      exitCode,
      stdout,
      stderr: stderrChunks.join(""),
      logs: logChunks.join("\n"),
      ...(params.parseJson ? { parsedJson: JSON.parse(stdout || "{}") as T } : {}),
    };
  } finally {
    process.stdout.write = originalStdoutWrite;
    process.stderr.write = originalStderrWrite;
    console.log = originalConsoleLog;
  }
}