// test-lane: unit

import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { AUDIT_LOG_SCHEMA_VERSION, AuditLogger } from "../../src/mcp/audit.js";
import { createBufferedCommandIo } from "../helpers/cli/createBufferedCommandIo.js";

async function createLogger(enabled = true) {
  const fs = await import("node:fs/promises");
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "cx-audit-test-"));
  const logger = new AuditLogger(tmpDir, enabled);

  return {
    logger,
    tmpDir,
    cleanup: async () => fs.rm(tmpDir, { recursive: true, force: true }),
  };
}

describe("MCP Audit Logger", () => {
  describe("logToolEvent", () => {
    it("logs request-aware tool events with execution status", async () => {
      const { logger, cleanup } = await createLogger();

      try {
        await logger.logToolEvent({
          tool: "read",
          capability: "read",
          decision: "allowed",
          reason: "Tool read (capability: read) is allowed",
          args: {
            path: "src/mcp/audit.ts",
            startLine: 1,
            endLine: 50,
          },
          execution: {
            durationMs: 14,
            status: "succeeded",
          },
          metadata: {
            agentReason: "Inspect the audit logger implementation.",
            policyName: "default-deny-mutate",
            decisionBasis: ["tool_catalog", "policy_allow_list"],
            userGoal: "Explain how audit logging currently works.",
          },
        });

        const events = await logger.readLog();
        expect(events).toHaveLength(1);

        const event = events[0];
        expect(event?.schemaVersion).toBe(AUDIT_LOG_SCHEMA_VERSION);
        expect(event?.tool).toBe("read");
        expect(event?.traceId).toContain("read:read:allowed:");
        expect(event?.sessionId).toMatch(/^mcp-session-/u);
        expect(event?.requestId).toBe("req-000001");
        expect(event?.capability).toBe("read");
        expect(event?.decision).toBe("allowed");
        expect(event?.path).toBe("src/mcp/audit.ts");
        expect(event?.policyName).toBe("default-deny-mutate");
        expect(event?.decisionBasis).toEqual([
          "tool_catalog",
          "policy_allow_list",
        ]);
        expect(event?.request.agentReason).toBe(
          "Inspect the audit logger implementation.",
        );
        expect(event?.request.userGoal).toBe(
          "Explain how audit logging currently works.",
        );
        expect(event?.request.args).toEqual({
          endLine: 50,
          path: "src/mcp/audit.ts",
          startLine: 1,
        });
        expect(event?.request.redaction).toEqual({
          applied: false,
          rules: [],
        });
        expect(event?.execution).toEqual({
          durationMs: 14,
          status: "succeeded",
        });
        expect(event?.timestamp).toBeDefined();
      } finally {
        await cleanup();
      }
    });

    it("redacts freeform text, blob-like fields, and secret-like values", async () => {
      const { logger, cleanup } = await createLogger();

      try {
        await logger.logToolEvent({
          tool: "replace_repomix_span",
          capability: "mutate",
          decision: "allowed",
          reason: "Tool replace_repomix_span (capability: mutate) is allowed",
          args: {
            path: "src/index.ts",
            replacement: "export const value = 2;\nexport const next = 3;\n",
            token: "super-secret-token",
            payload:
              "VGhpcy1sb29rcy1saWtlLWEtYmxvYi1idXQtaXMtbG9uZy1lbm91Z2gtdG8tZmlyZS10aGUtaGV1cmlzdGljcy1hbmQtc2hvdWxkLW5vdC1iZS1sb2dnZWQtcmF3",
          },
          execution: {
            durationMs: 9,
            status: "failed",
            error: "tool handler interrupted after partial output",
          },
          metadata: {
            policyName: "unrestricted",
            decisionBasis: ["tool_catalog", "policy_allow_list"],
          },
        });

        const [event] = await logger.readLog();
        expect(event?.request.redaction.applied).toBe(true);
        expect(event?.request.redaction.rules).toEqual([
          "binary_or_blob",
          "body_text",
          "secret_like_key",
        ]);
        expect(event?.request.args.path).toBe("src/index.ts");
        expect(event?.request.args.replacement).toMatchObject({
          kind: "redacted_text",
        });
        expect(event?.request.args.token).toMatchObject({
          kind: "redacted_secret",
        });
        expect(event?.request.args.payload).toMatchObject({
          kind: "redacted_blob",
        });
        expect(event?.execution).toEqual({
          durationMs: 9,
          error: "tool handler interrupted after partial output",
          status: "failed",
        });
      } finally {
        await cleanup();
      }
    });

    it("increments request ids across writes in one session", async () => {
      const { logger, cleanup } = await createLogger();

      try {
        await logger.logToolEvent({
          tool: "list",
          capability: "read",
          decision: "allowed",
          reason: "allowed",
          execution: { status: "succeeded" },
        });
        await logger.logToolEvent({
          tool: "grep",
          capability: "read",
          decision: "allowed",
          reason: "allowed",
          execution: { status: "succeeded" },
        });

        const events = await logger.readLog();
        expect(events.map((event) => event.requestId)).toEqual([
          "req-000001",
          "req-000002",
        ]);
        expect(events[0]?.sessionId).toBe(events[1]?.sessionId);
      } finally {
        await cleanup();
      }
    });

    it("handles disabled audit logging gracefully", async () => {
      const { logger, cleanup } = await createLogger(false);

      try {
        await logger.logToolEvent({
          tool: "notes_new",
          capability: "mutate",
          decision: "denied",
          reason: "Access denied",
          execution: { status: "denied" },
        });

        await expect(logger.readLog()).resolves.toEqual([]);
      } finally {
        await cleanup();
      }
    });

    it("warns and continues when audit logging fails", async () => {
      const fs = await import("node:fs/promises");
      const tmpDir = await fs.mkdtemp(
        path.join(os.tmpdir(), "cx-audit-failure-"),
      );
      const blockedRoot = path.join(tmpDir, "workspace-root.txt");
      await fs.writeFile(blockedRoot, "not a directory", "utf8");

      const capture = createBufferedCommandIo();
      const logger = new AuditLogger(
        blockedRoot,
        true,
        capture.io.stderr ?? process.stderr,
      );

      try {
        await logger.logToolEvent({
          tool: "list",
          capability: "read",
          decision: "allowed",
          reason: "ok",
          execution: { status: "succeeded" },
        });
      } finally {
        await fs.rm(tmpDir, { recursive: true, force: true });
      }

      expect(capture.stderr()).toContain("Warning: Failed to write audit log");
      expect(await logger.readLog()).toEqual([]);
    });
  });

  describe("getSummary", () => {
    it("computes correct summary statistics", async () => {
      const { logger, cleanup } = await createLogger();

      try {
        await logger.logToolEvent({
          tool: "list",
          capability: "read",
          decision: "allowed",
          reason: "allowed",
          execution: { status: "succeeded" },
        });
        await logger.logToolEvent({
          tool: "doctor_mcp",
          capability: "observe",
          decision: "allowed",
          reason: "allowed",
          execution: { status: "succeeded" },
          metadata: {
            agentReason: "Inspect the MCP profile.",
            policyName: "default-deny-mutate",
          },
        });
        await logger.logToolEvent({
          tool: "bundle",
          capability: "plan",
          decision: "allowed",
          reason: "allowed",
          execution: { status: "succeeded" },
        });
        await logger.logToolEvent({
          tool: "notes_new",
          capability: "mutate",
          decision: "denied",
          reason: "denied",
          execution: { status: "denied" },
          metadata: { policyName: "strict-read-only" },
        });

        const summary = await logger.getSummary();
        expect(summary.totalEvents).toBe(4);
        expect(summary.allowedCount).toBe(3);
        expect(summary.deniedCount).toBe(1);
        expect(summary.byCapability).toEqual({
          read: 1,
          observe: 1,
          plan: 1,
          mutate: 1,
        });
        expect(summary.byAgentReasonPresence).toEqual({
          missing: 3,
          provided: 1,
        });
        expect(summary.byPolicyName).toEqual({
          "default-deny-mutate": 1,
          "strict-read-only": 1,
          "unknown-policy": 2,
        });
        expect(summary.recentTraceIds).toHaveLength(4);
      } finally {
        await cleanup();
      }
    });

    it("handles empty audit log", async () => {
      const { logger, cleanup } = await createLogger();

      try {
        const summary = await logger.getSummary();
        expect(summary.totalEvents).toBe(0);
        expect(summary.allowedCount).toBe(0);
        expect(summary.deniedCount).toBe(0);
        expect(summary.byAgentReasonPresence).toEqual({
          missing: 0,
          provided: 0,
        });
        expect(summary.byPolicyName).toEqual({});
        expect(summary.recentTraceIds).toEqual([]);
      } finally {
        await cleanup();
      }
    });

    it("normalizes legacy audit entries without request envelopes", async () => {
      const fs = await import("node:fs/promises");
      const { logger, cleanup } = await createLogger();

      try {
        await fs.mkdir(path.dirname(logger.getLogPath()), { recursive: true });
        await fs.writeFile(
          logger.getLogPath(),
          `${JSON.stringify({
            timestamp: "2026-04-25T12:37:17.888Z",
            traceId: "list:read:allowed:1777120637891",
            tool: "list",
            capability: "read",
            decision: "allowed",
            reason: "Tool list (capability: read) is allowed",
            policyName: "default-deny-mutate",
            decisionBasis: ["tool_catalog", "policy_allow_list"],
          })}\n`,
          "utf8",
        );

        const events = await logger.readLog();
        expect(events).toHaveLength(1);
        expect(events[0]?.request.agentReason).toBe("(not provided)");
        expect(events[0]?.request.args).toEqual({});
        expect(events[0]?.request.redaction).toEqual({
          applied: false,
          rules: [],
        });
        expect(events[0]?.execution.status).toBe("succeeded");
        expect(events[0]?.sessionId).toBe("legacy-session");

        const summary = await logger.getSummary();
        expect(summary.totalEvents).toBe(1);
        expect(summary.allowedCount).toBe(1);
        expect(summary.byAgentReasonPresence).toEqual({
          missing: 1,
          provided: 0,
        });
        expect(summary.byPolicyName).toEqual({
          "default-deny-mutate": 1,
        });
      } finally {
        await cleanup();
      }
    });
  });

  describe("getRecentEvents", () => {
    it("filters by traceId and sessionId", async () => {
      const { logger, cleanup } = await createLogger();

      try {
        await logger.logToolEvent({
          tool: "read",
          capability: "read",
          decision: "allowed",
          reason: "allowed",
          execution: { status: "succeeded" },
        });
        await logger.logToolEvent({
          tool: "grep",
          capability: "read",
          decision: "allowed",
          reason: "allowed",
          execution: { status: "succeeded" },
          metadata: {
            agentReason: "Search for audit references.",
          },
        });

        const allEvents = await logger.readLog();
        const traceId = allEvents[1]?.traceId;
        const sessionId = allEvents[1]?.sessionId;
        if (!traceId || !sessionId) {
          throw new Error("expected traceId and sessionId");
        }

        const byTrace = await logger.getRecentEvents({ limit: 5, traceId });
        expect(byTrace.events).toHaveLength(1);
        expect(byTrace.events[0]?.traceId).toBe(traceId);

        const bySession = await logger.getRecentEvents({ limit: 5, sessionId });
        expect(bySession.events).toHaveLength(2);
        expect(bySession.events[0]?.sessionId).toBe(sessionId);
        expect(bySession.events[1]?.sessionId).toBe(sessionId);
      } finally {
        await cleanup();
      }
    });
  });

  describe("clear", () => {
    it("removes the audit log file", async () => {
      const fs = await import("node:fs/promises");
      const { logger, tmpDir, cleanup } = await createLogger();

      try {
        await logger.logToolEvent({
          tool: "list",
          capability: "read",
          decision: "allowed",
          reason: "allowed",
          execution: { status: "succeeded" },
        });

        expect((await logger.readLog()).length).toBe(1);

        await logger.clear();

        await expect(logger.readLog()).resolves.toEqual([]);
        await expect(fs.access(logger.getLogPath())).rejects.toThrow();
      } finally {
        await cleanup();
        await fs.rm(tmpDir, { recursive: true, force: true });
      }
    });
  });
});
