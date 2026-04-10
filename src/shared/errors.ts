export class CxError extends Error {
  readonly exitCode: number;

  constructor(message: string, exitCode = 2, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'CxError';
    this.exitCode = exitCode;
  }
}

export function asError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}
