import fs from "node:fs/promises";
import path from "node:path";

import { ensureDir } from "../shared/fs.js";
import type { CommandWriteStream } from "../shared/output.js";
import type { McpCapability } from "./capabilities.js";
import type { AuditEvent } from "./policy.js";

/**
 * Audit logger for MCP policy enforcement events.
 * Writes to .cx/audit.log in JSONL format (one JSON event per line).
 */
export class AuditLogger {
  private logFilePath: string;
  private enabled: boolean;
  private stderr: CommandWriteStream;

  constructor(
    workspaceRoot: string,
    enabled: boolean = true,
    stderr: CommandWriteStream = process.stderr,
  ) {
    this.logFilePath = path.join(workspaceRoot, ".cx", "audit.log");
    this.enabled = enabled;
    this.stderr = stderr;
  }

  /**
   * Log a policy enforcement event.
   */
  async logEvent(
    tool: string,
    capability: McpCapability,
    decision: "allowed" | "denied",
    reason: string,
    metadata?: {
      filePath?: string;
      policyName?: string;
      decisionBasis?: string[];
    },
  ): Promise<void> {
    if (!this.enabled) {
      return;
    }

    const event: AuditEvent = {
      timestamp: new Date().toISOString(),
      traceId: `${tool}:${capability}:${decision}:${Date.now()}`,
      tool,
      capability,
      decision,
      reason,
      policyName: metadata?.policyName ?? "unknown-policy",
      decisionBasis: metadata?.decisionBasis ?? ["manual_log"],
      ...(metadata?.filePath ? { path: metadata.filePath } : {}),
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
   * Log a tool access decision.
   */
  async logToolAccess(
    tool: string,
    capability: McpCapability,
    allowed: boolean,
    reason: string,
    metadata?: {
      filePath?: string;
      policyName?: string;
      decisionBasis?: string[];
    },
  ): Promise<void> {
    await this.logEvent(
      tool,
      capability,
      allowed ? "allowed" : "denied",
      reason,
      metadata,
    );
  }

  /**
   * Read audit log entries (for diagnostics).
   */
  async readLog(): Promise<AuditEvent[]> {
    try {
      const content = await fs.readFile(this.logFilePath, "utf8");
      return content
        .split("\n")
        .filter((line) => line.trim())
        .map((line) => JSON.parse(line) as AuditEvent);
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

  /**
   * Summary statistics from audit log.
   */
  async getSummary(): Promise<{
    totalEvents: number;
    allowedCount: number;
    deniedCount: number;
    byCapability: Record<McpCapability, number>;
  }> {
    const events = await this.readLog();

    const summary = {
      totalEvents: events.length,
      allowedCount: 0,
      deniedCount: 0,
      byCapability: {
        read: 0,
        observe: 0,
        plan: 0,
        mutate: 0,
      } as Record<McpCapability, number>,
    };

    for (const event of events) {
      if (event.decision === "allowed") {
        summary.allowedCount += 1;
      } else {
        summary.deniedCount += 1;
      }
      const count = summary.byCapability[event.capability];
      summary.byCapability[event.capability] = (count ?? 0) + 1;
    }

    return summary;
  }
}
