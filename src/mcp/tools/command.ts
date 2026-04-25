import { CxError } from "../../shared/errors.js";
import type { CommandIo, CommandWriteStream } from "../../shared/output.js";

function createBufferStream(chunks: string[]): CommandWriteStream {
  return {
    write(chunk: string | Uint8Array): boolean {
      chunks.push(
        typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8"),
      );
      return true;
    },
  };
}

export async function runJsonCommandPayload(
  cwd: string,
  runner: (io: Partial<CommandIo>) => Promise<number>,
): Promise<unknown> {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const logs: string[] = [];
  const exitCode = await runner({
    stdout: createBufferStream(stdout),
    stderr: createBufferStream(stderr),
    log: (...args: unknown[]) => {
      logs.push(args.map((arg) => String(arg)).join(" "));
    },
    cwd,
    env: process.env,
    stdin: { isTTY: false },
    emitBehaviorLogs: false,
  });

  const text = stdout.join("").trim();
  if (text.length === 0) {
    throw new CxError(
      `Command did not emit JSON output.${stderr.length > 0 ? ` stderr: ${stderr.join("").trim()}` : ""}${logs.length > 0 ? ` logs: ${logs.join("\n")}` : ""}`,
      exitCode === 0 ? 1 : exitCode,
    );
  }

  try {
    return JSON.parse(text);
  } catch (error) {
    throw new CxError(
      `Command emitted invalid JSON: ${error instanceof Error ? error.message : String(error)}`,
      exitCode === 0 ? 1 : exitCode,
    );
  }
}
