export interface ErrorRemediation {
  readonly recommendedCommand?: string;
  readonly docsRef?: string;
  readonly whyThisProtectsYou?: string;
  readonly nextSteps?: readonly string[];
  readonly scopeHint?: ScopeHint;
}

export interface ScopeHint {
  readonly sectionFlag: string;
  readonly configKey: string;
  readonly example: string;
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

export function buildScopeHint(configKey: string): ScopeHint {
  switch (configKey) {
    case "notes.applies_to_sections":
      return {
        sectionFlag: "--section",
        configKey,
        example: 'set applies_to_sections = ["src/**"] in [notes]',
      };
    case "dedup.mode":
      return {
        sectionFlag: "--lenient",
        configKey,
        example: "run cx --lenient bundle for a one-off warning-mode pass",
      };
    case "config.duplicate_entry":
      return {
        sectionFlag: "--lenient",
        configKey,
        example:
          "run cx --lenient bundle to downgrade duplicate config entries to warnings",
      };
    default:
      return {
        sectionFlag: "--lenient",
        configKey,
        example: "run cx --lenient <command> for a one-off relaxation",
      };
  }
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
  if (remediation.whyThisProtectsYou) {
    lines.push(`Why this protects you: ${remediation.whyThisProtectsYou}`);
  }
  if (remediation.scopeHint) {
    lines.push(
      `Scope this gate: ${remediation.scopeHint.configKey} via ${remediation.scopeHint.sectionFlag}; ${remediation.scopeHint.example}.`,
    );
  }
  for (const step of remediation.nextSteps ?? []) {
    lines.push(`Next step: ${step}`);
  }
  return lines;
}
