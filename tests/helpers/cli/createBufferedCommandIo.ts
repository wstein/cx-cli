import type {
  CommandIo,
  CommandWriteStream,
} from "../../../src/shared/output.js";

/**
 * Preferred command-test helper.
 *
 * Use this for direct command coverage instead of captureCli() so tests can
 * inject stdout/stderr/log and cwd explicitly without mutating process globals.
 */

function createBufferedWriter(chunks: string[]) {
  return {
    write(
      chunk: string | Uint8Array,
      encodingOrCallback?: BufferEncoding | ((error?: Error | null) => void),
      callback?: (error?: Error | null) => void,
    ): boolean {
      chunks.push(String(chunk));
      const resolvedCallback =
        typeof encodingOrCallback === "function"
          ? encodingOrCallback
          : callback;
      resolvedCallback?.();
      return true;
    },
  };
}

export function createBufferedCommandIo(
  options: { cwd?: string; env?: NodeJS.ProcessEnv; isTTY?: boolean } = {},
): {
  io: Partial<CommandIo> & {
    stdout: CommandWriteStream;
    stderr: CommandWriteStream;
    log: (...args: unknown[]) => void;
    env: NodeJS.ProcessEnv;
    stdin: Pick<NodeJS.ReadStream, "isTTY">;
  };
  stdout: () => string;
  stderr: () => string;
  logs: () => string;
} {
  const stdoutChunks: string[] = [];
  const stderrChunks: string[] = [];
  const logChunks: string[] = [];

  return {
    io: {
      stdout: createBufferedWriter(stdoutChunks),
      stderr: createBufferedWriter(stderrChunks),
      log: (...args: unknown[]) => {
        logChunks.push(args.map((value) => String(value)).join(" "));
      },
      env: options.env ?? process.env,
      stdin: {
        isTTY: options.isTTY ?? false,
      },
      emitBehaviorLogs: false,
      ...(options.cwd !== undefined ? { cwd: options.cwd } : {}),
    },
    stdout: () => stdoutChunks.join(""),
    stderr: () => stderrChunks.join(""),
    logs: () => logChunks.join("\n"),
  };
}
