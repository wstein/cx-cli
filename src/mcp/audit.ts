import fs from "node:fs/promises";
import path from "node:path";

import { ensureDir } from "../shared/fs.js";
import type { McpCapability } from "./capabilities.js";
import type { AuditEvent } from "./policy.js";

/**
 * Audit logger for MCP policy enforcement events.
 * Writes to .cx/audit.log in JSONL format (one JSON event per line).
 */
export class AuditLogger {
  private logFilePath: string;
  private enabled: boolean;

  constructor(workspaceRoot: string, enabled: boolean = true) {
    this.logFilePath = path.join(workspaceRoot, ".cx", "audit.log");
    this.enabled = enabled;
  }

  /**
   * Log a policy enforcement event.
   */
  async logEvent(
    tool: string,
    capability: McpCapability,
    decision: "allowed" | "denied",
    reason: string,
    filePath?: string,
  ): Promise<void> {
    if (!this.enabled) {
      return;
    }

    const event: AuditEvent = {
      timestamp: new Date().toISOString(),
      tool,
      capability,
      decision,
      reason,
      ...(filePath ? { path: filePath } : {}),
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
      process.stderr.write(`Warning: Failed to write audit log: ${errorMsg}\n`);
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
  ): Promise<void> {
    await this.logEvent(
      tool,
      capability,
      allowed ? "allowed" : "denied",
      reason,
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
