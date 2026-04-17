/**
 * MCP Server operational safeguards: policy enforcement, timeout enforcement,
 * request logging, and basic rate limiting to prevent abuse and provide audit trails.
 */

import { AuditLogger } from "./audit.js";
import { checkToolAccess, PolicyError, resolvePolicy } from "./policy.js";

interface ToolCallMetrics {
  toolName: string;
  startTime: number;
  endTime?: number;
  durationMs?: number;
  status: "pending" | "success" | "timeout" | "error";
  error?: string | undefined;
}

interface RateLimitState {
  requestCount: number;
  windowStart: number;
}

/**
 * Request metrics logger for audit trail and debugging.
 * Logs all tool invocations with timing and status.
 * Also enforces policy-based tool access control.
 */
export class McpRequestLogger {
  private metrics: ToolCallMetrics[] = [];
  private readonly maxHistorySize = 1000; // Keep last N tool invocations in memory
  private readonly auditLogger: AuditLogger | undefined;

  constructor(auditLogger?: AuditLogger) {
    this.auditLogger = auditLogger;
  }

  /**
   * Verify tool access before execution.
   * Throws PolicyError if access is denied.
   */
  async checkToolAccess(toolName: string): Promise<void> {
    const policy = resolvePolicy();
    const decision = checkToolAccess(toolName, policy);

    if (this.auditLogger) {
      await this.auditLogger.logToolAccess(
        toolName,
        decision.capability,
        decision.allowed,
        decision.reason,
      );
    }

    if (!decision.allowed) {
      throw new PolicyError(
        toolName,
        decision.capability,
        `Access denied: ${decision.reason}`,
      );
    }
  }

  logStart(_toolName: string): { startTime: number } {
    const startTime = Date.now();
    return { startTime };
  }

  logEnd(
    toolName: string,
    startTime: number,
    status: "success" | "timeout" | "error",
    error?: string,
  ): void {
    const endTime = Date.now();
    const metric: ToolCallMetrics = {
      toolName,
      startTime,
      endTime,
      durationMs: endTime - startTime,
      status,
      error,
    };

    this.metrics.push(metric);

    // Keep history bounded
    if (this.metrics.length > this.maxHistorySize) {
      this.metrics.shift();
    }

    // Log to stderr for operational visibility
    const logLine = `[${new Date(startTime).toISOString()}] cx mcp tool: ${toolName} | status=${status} | duration=${metric.durationMs}ms${error ? ` | error=${error}` : ""}`;
    process.stderr.write(`${logLine}\n`);
  }

  getMetrics(): Readonly<ToolCallMetrics[]> {
    return Object.freeze([...this.metrics]);
  }
}

/**
 * Basic rate limiter using a sliding window approach.
 * Enforces a maximum request count per time window.
 */
export class McpRateLimiter {
  private state: RateLimitState = {
    requestCount: 0,
    windowStart: Date.now(),
  };

  private readonly maxRequests = 100; // Max 100 requests per window
  private readonly windowDurationMs = 60_000; // 60 second window

  /**
   * Check if a new request is allowed under the current rate limit.
   * Returns true if allowed, false if rate limit exceeded.
   */
  isAllowed(): boolean {
    const now = Date.now();
    const elapsed = now - this.state.windowStart;

    // Reset window if duration has passed
    if (elapsed > this.windowDurationMs) {
      this.state = {
        requestCount: 0,
        windowStart: now,
      };
    }

    // Check limit
    if (this.state.requestCount >= this.maxRequests) {
      return false;
    }

    this.state.requestCount += 1;
    return true;
  }

  getState(): Readonly<RateLimitState> {
    return Object.freeze({ ...this.state });
  }
}

/**
 * Executes a function with a timeout.
 * Rejects if execution exceeds timeoutMs.
 */
export async function withTimeout<T>(
  fn: () => Promise<T>,
  timeoutMs: number,
): Promise<T> {
  return Promise.race([
    fn(),
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error("Tool execution timeout")), timeoutMs),
    ),
  ]);
}
