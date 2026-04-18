import type { ZodType } from "zod";

export interface CommandWriteStream {
  write(
    chunk: string | Uint8Array,
    encodingOrCallback?: BufferEncoding | ((error?: Error | null) => void),
    callback?: (error?: Error | null) => void,
  ): boolean;
}

export interface CommandIo {
  stdout: CommandWriteStream;
  stderr: CommandWriteStream;
  log: (...args: unknown[]) => void;
  env: NodeJS.ProcessEnv;
  stdin: Pick<NodeJS.ReadStream, "isTTY">;
}

export function resolveCommandIo(io: Partial<CommandIo> = {}): CommandIo {
  return {
    stdout: io.stdout ?? process.stdout,
    stderr: io.stderr ?? process.stderr,
    log: io.log ?? console.log,
    env: io.env ?? process.env,
    stdin: io.stdin ?? process.stdin,
  };
}

export function writeStdout(text: string, io: Partial<CommandIo> = {}): void {
  resolveCommandIo(io).stdout.write(text);
}

export function writeStderr(text: string, io: Partial<CommandIo> = {}): void {
  resolveCommandIo(io).stderr.write(text);
}

export function writeLog(
  ...params: [text: string, io?: Partial<CommandIo>]
): void {
  const [text, io = {}] = params;
  resolveCommandIo(io).log(text);
}

export function writeJson(value: unknown, io: Partial<CommandIo> = {}): void {
  writeStdout(`${JSON.stringify(value, null, 2)}\n`, io);
}

export function writeValidatedJson<T>(
  schema: ZodType<T>,
  value: unknown,
  io: Partial<CommandIo> = {},
): void {
  writeJson(schema.parse(value), io);
}
