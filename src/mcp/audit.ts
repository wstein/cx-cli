import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import { ensureDir } from "../shared/fs.js";
import type { CommandWriteStream } from "../shared/output.js";
import type { McpCapability } from "./capabilities.js";

export const AUDIT_LOG_SCHEMA_VERSION = 2;

export type AuditExecutionStatus =
  | "denied"
  | "failed"
  | "succeeded"
  | "timed_out";

export type AuditRedactionRule =
  | "binary_or_blob"
  | "body_text"
  | "large_freeform_text"
  | "prompt_like_input"
  | "secret_like_key";

interface AuditRedactionSummary {
  applied: boolean;
  rules: AuditRedactionRule[];
}

interface AuditRedactedValueBase {
  sha256: string;
  length: number;
}

interface AuditRedactedSecret extends AuditRedactedValueBase {
  kind: "redacted_secret";
}

interface AuditRedactedText extends AuditRedactedValueBase {
  kind: "redacted_text";
  preview?: string;
}

interface AuditRedactedBlob extends AuditRedactedValueBase {
  kind: "redacted_blob";
}

export type AuditLoggedScalar = boolean | null | number | string;
export type AuditLoggedValue =
  | AuditLoggedScalar
  | AuditLoggedValue[]
  | { [key: string]: AuditLoggedValue }
  | AuditRedactedBlob
  | AuditRedactedSecret
  | AuditRedactedText;

interface AuditRequestEnvelope {
  agentReason: string;
  args: Record<string, AuditLoggedValue>;
  redaction: AuditRedactionSummary;
  userGoal?: string;
}

interface AuditExecutionEnvelope {
  durationMs?: number;
  error?: string;
  status: AuditExecutionStatus;
}

export interface AuditLogEvent {
  schemaVersion: typeof AUDIT_LOG_SCHEMA_VERSION;
  timestamp: string;
  traceId: string;
  sessionId: string;
  requestId: string;
  tool: string;
  capability: McpCapability;
  path?: string;
  decision: "allowed" | "denied";
  reason: string;
  policyName: string;
  decisionBasis: string[];
  request: AuditRequestEnvelope;
  execution: AuditExecutionEnvelope;
}

export interface AuditRecentEvents {
  events: AuditLogEvent[];
  limit: number;
}

interface AuditLogToolEventParams {
  tool: string;
  capability: McpCapability;
  decision: "allowed" | "denied";
  reason: string;
  args?: Record<string, unknown>;
  execution: AuditExecutionEnvelope;
  metadata?: {
    agentReason?: string;
    decisionBasis?: string[];
    filePath?: string;
    policyName?: string;
    userGoal?: string;
  };
}

const ALWAYS_REDACT_TEXT_KEYS = new Set([
  "body",
  "content",
  "prompt",
  "replacement",
  "text",
]);
const PROMPT_LIKE_KEYS = new Set([
  "agentReason",
  "instruction",
  "instructions",
  "message",
  "prompt",
  "reasoning",
  "systemPrompt",
  "userGoal",
]);
const SECRET_LIKE_KEY_PATTERN =
  /(?:api[_-]?key|auth(?:orization)?|cookie|password|secret|session|token)/iu;
const BLOB_LIKE_STRING_PATTERN = /^[A-Za-z0-9+/=_-]{96,}$/u;
const MAX_INLINE_STRING_LENGTH = 160;
const MAX_PREVIEW_LENGTH = 80;

export interface AuditSummary {
  totalEvents: number;
  allowedCount: number;
  deniedCount: number;
  byCapability: Record<McpCapability, number>;
  byExecutionStatus: Record<AuditExecutionStatus, number>;
  byPolicyName: Record<string, number>;
  byRedactionRule: Record<AuditRedactionRule, number>;
  recentTraceIds: string[];
}

export async function collectAuditSummary(
  workspaceRoot: string,
): Promise<AuditSummary> {
  const logger = new AuditLogger(workspaceRoot, true);
  return logger.getSummary();
}

export async function collectRecentAuditEvents(
  workspaceRoot: string,
  limit: number,
): Promise<AuditRecentEvents> {
  const logger = new AuditLogger(workspaceRoot, true);
  return logger.getRecentEvents(limit);
}

/**
 * Audit logger for finalized MCP tool events.
 * Writes request-aware JSONL records to .cx/audit.log.
 */
export class AuditLogger {
  private readonly enabled: boolean;
  private readonly logFilePath: string;
  private nextRequestSequence = 0;
  private readonly sessionId: string;
  private readonly stderr: CommandWriteStream;

  constructor(
    workspaceRoot: string,
    enabled: boolean = true,
    stderr: CommandWriteStream = process.stderr,
  ) {
    this.logFilePath = path.join(workspaceRoot, ".cx", "audit.log");
    this.enabled = enabled;
    this.sessionId = `mcp-session-${randomUUID()}`;
    this.stderr = stderr;
  }

  private summarizeString(
    value: string,
    kind:
      | AuditRedactedBlob["kind"]
      | AuditRedactedText["kind"]
      | AuditRedactedSecret["kind"],
    includePreview: boolean,
  ): AuditRedactedBlob | AuditRedactedSecret | AuditRedactedText {
    const base = {
      sha256: createHash("sha256").update(value).digest("hex"),
      length: value.length,
    } satisfies AuditRedactedValueBase;

    if (kind === "redacted_blob") {
      return {
        kind,
        ...base,
      };
    }

    if (kind === "redacted_secret") {
      return {
        kind,
        ...base,
      };
    }

    return {
      kind,
      ...base,
      ...(includePreview
        ? {
            preview: value
              .replace(/\s+/gu, " ")
              .trim()
              .slice(0, MAX_PREVIEW_LENGTH),
          }
        : {}),
    };
  }

  private sanitizeValue(
    keyPath: string[],
    value: unknown,
    redactionRules: Set<AuditRedactionRule>,
  ): AuditLoggedValue {
    if (
      value === null ||
      typeof value === "boolean" ||
      typeof value === "number"
    ) {
      return value;
    }

    if (typeof value === "string") {
      const key = keyPath.at(-1) ?? "";
      if (SECRET_LIKE_KEY_PATTERN.test(key)) {
        redactionRules.add("secret_like_key");
        return this.summarizeString(value, "redacted_secret", false);
      }

      if (ALWAYS_REDACT_TEXT_KEYS.has(key)) {
        redactionRules.add("body_text");
        return this.summarizeString(value, "redacted_text", true);
      }

      if (PROMPT_LIKE_KEYS.has(key)) {
        redactionRules.add("prompt_like_input");
        return this.summarizeString(value, "redacted_text", true);
      }

      if (BLOB_LIKE_STRING_PATTERN.test(value) || value.includes("\u0000")) {
        redactionRules.add("binary_or_blob");
        return this.summarizeString(value, "redacted_blob", false);
      }

      if (value.includes("\n") || value.length > MAX_INLINE_STRING_LENGTH) {
        redactionRules.add("large_freeform_text");
        return this.summarizeString(value, "redacted_text", true);
      }

      return value;
    }

    if (Array.isArray(value)) {
      return value.map((entry, index) =>
        this.sanitizeValue([...keyPath, String(index)], entry, redactionRules),
      );
    }

    if (typeof value === "object") {
      const entries = Object.entries(value as Record<string, unknown>).sort(
        (left, right) => left[0].localeCompare(right[0], "en"),
      );
      return Object.fromEntries(
        entries.map(([key, nestedValue]) => [
          key,
          this.sanitizeValue([...keyPath, key], nestedValue, redactionRules),
        ]),
      );
    }

    redactionRules.add("binary_or_blob");
    return this.summarizeString(String(value), "redacted_blob", false);
  }

  private sanitizeArgs(args?: Record<string, unknown>): {
    args: Record<string, AuditLoggedValue>;
    redaction: AuditRedactionSummary;
  } {
    const redactionRules = new Set<AuditRedactionRule>();
    const rawArgs = args ?? {};
    const entries = Object.entries(rawArgs).sort((left, right) =>
      left[0].localeCompare(right[0], "en"),
    );
    const sanitizedArgs = Object.fromEntries(
      entries.map(([key, value]) => [
        key,
        this.sanitizeValue([key], value, redactionRules),
      ]),
    );

    return {
      args: sanitizedArgs,
      redaction: {
        applied: redactionRules.size > 0,
        rules: [...redactionRules].sort((left, right) =>
          left.localeCompare(right, "en"),
        ),
      },
    };
  }

  private resolvePathHint(
    args: Record<string, unknown> | undefined,
    metadata: AuditLogToolEventParams["metadata"],
  ): string | undefined {
    if (metadata?.filePath) {
      return metadata.filePath;
    }

    const pathValue = args?.path;
    return typeof pathValue === "string" && pathValue.length > 0
      ? pathValue
      : undefined;
  }

  async logToolEvent(params: AuditLogToolEventParams): Promise<void> {
    if (!this.enabled) {
      return;
    }

    this.nextRequestSequence += 1;
    const requestId = `req-${String(this.nextRequestSequence).padStart(6, "0")}`;
    const { args, redaction } = this.sanitizeArgs(params.args);
    const pathHint = this.resolvePathHint(params.args, params.metadata);
    const event: AuditLogEvent = {
      schemaVersion: AUDIT_LOG_SCHEMA_VERSION,
      timestamp: new Date().toISOString(),
      traceId: `${params.tool}:${params.capability}:${params.decision}:${Date.now()}`,
      sessionId: this.sessionId,
      requestId,
      tool: params.tool,
      capability: params.capability,
      decision: params.decision,
      reason: params.reason,
      policyName: params.metadata?.policyName ?? "unknown-policy",
      decisionBasis: params.metadata?.decisionBasis ?? ["manual_log"],
      ...(pathHint ? { path: pathHint } : {}),
      request: {
        agentReason: params.metadata?.agentReason ?? "(not provided)",
        args,
        redaction,
        ...(params.metadata?.userGoal
          ? { userGoal: params.metadata.userGoal }
          : {}),
      },
      execution: params.execution,
    };

    try {
      await ensureDir(path.dirname(this.logFilePath));
      await fs.appendFile(
        this.logFilePath,
        `${JSON.stringify(event)}\n`,
        "utf8",
      );
    } catch (error) {
      // Audit logging failures should not crash the tool
      // Log to stderr and continue
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.stderr.write(`Warning: Failed to write audit log: ${errorMsg}\n`);
    }
  }

  /**
   * Read audit log entries (for diagnostics).
   */
  async readLog(): Promise<AuditLogEvent[]> {
    try {
      const content = await fs.readFile(this.logFilePath, "utf8");
      return content
        .split("\n")
        .filter((line) => line.trim())
        .map((line) => JSON.parse(line) as AuditLogEvent);
    } catch {
      return [];
    }
  }

  /**
   * Clear audit log (for testing).
   */
  async clear(): Promise<void> {
    try {
      await fs.rm(this.logFilePath, { force: true });
    } catch {
      // Ignore errors during clearing
    }
  }

  /**
   * Get audit log path.
   */
  getLogPath(): string {
    return this.logFilePath;
  }

  async getRecentEvents(limit: number): Promise<AuditRecentEvents> {
    const normalizedLimit = Math.max(1, Math.floor(limit));
    const events = await this.readLog();

    return {
      limit: normalizedLimit,
      events: events.slice(-normalizedLimit).reverse(),
    };
  }

  /**
   * Summary statistics from audit log.
   */
  async getSummary(): Promise<AuditSummary> {
    const events = await this.readLog();

    const summary: AuditSummary = {
      totalEvents: events.length,
      allowedCount: 0,
      deniedCount: 0,
      byCapability: {
        read: 0,
        observe: 0,
        plan: 0,
        mutate: 0,
      },
      byExecutionStatus: {
        denied: 0,
        failed: 0,
        succeeded: 0,
        timed_out: 0,
      },
      byPolicyName: {},
      byRedactionRule: {
        binary_or_blob: 0,
        body_text: 0,
        large_freeform_text: 0,
        prompt_like_input: 0,
        secret_like_key: 0,
      },
      recentTraceIds: [],
    };

    for (const event of events) {
      if (event.decision === "allowed") {
        summary.allowedCount += 1;
      } else {
        summary.deniedCount += 1;
      }
      const count = summary.byCapability[event.capability];
      summary.byCapability[event.capability] = (count ?? 0) + 1;
      summary.byExecutionStatus[event.execution.status] += 1;
      summary.byPolicyName[event.policyName] =
        (summary.byPolicyName[event.policyName] ?? 0) + 1;
      for (const rule of event.request.redaction.rules) {
        summary.byRedactionRule[rule] += 1;
      }
    }

    summary.recentTraceIds = events
      .slice(-5)
      .reverse()
      .map((event) => event.traceId);

    return summary;
  }
}
