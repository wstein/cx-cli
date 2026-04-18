export interface ErrorRemediation {
  readonly recommendedCommand?: string;
  readonly docsRef?: string;
  readonly nextSteps?: readonly string[];
}

interface CxErrorOptions {
  readonly cause?: unknown;
  readonly remediation?: ErrorRemediation;
}

export class CxError extends Error {
  readonly exitCode: number;
  readonly remediation: ErrorRemediation | undefined;

  constructor(message: string, exitCode = 2, options?: CxErrorOptions) {
    super(message, options);
    this.name = "CxError";
    this.exitCode = exitCode;
    this.remediation = options?.remediation;
  }
}

export function asError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

export function getErrorRemediation(
  error: unknown,
): ErrorRemediation | undefined {
  return error instanceof CxError ? error.remediation : undefined;
}

export function formatErrorRemediation(
  remediation: ErrorRemediation | undefined,
): string[] {
  if (!remediation) {
    return [];
  }

  const lines: string[] = [];
  if (remediation.recommendedCommand) {
    lines.push(`Suggested command: ${remediation.recommendedCommand}`);
  }
  if (remediation.docsRef) {
    lines.push(`Docs: ${remediation.docsRef}`);
  }
  for (const step of remediation.nextSteps ?? []) {
    lines.push(`Next step: ${step}`);
  }
  return lines;
}
