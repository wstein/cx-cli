import type { CommandIo } from "../../../src/shared/output.js";

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

export function createBufferedCommandIo(): {
  io: Partial<CommandIo>;
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
      env: process.env,
      stdin: {
        isTTY: false,
      },
    },
    stdout: () => stdoutChunks.join(""),
    stderr: () => stderrChunks.join(""),
    logs: () => logChunks.join("\n"),
  };
}
