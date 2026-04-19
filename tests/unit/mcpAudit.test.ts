// test-lane: unit

import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { AuditLogger } from "../../src/mcp/audit.js";
import { createBufferedCommandIo } from "../helpers/cli/createBufferedCommandIo.js";

describe("MCP Audit Logger", () => {
  describe("logEvent", () => {
    it("logs tool access decision", async () => {
      const tmpDir = await import("node:fs/promises").then((fs) =>
        fs.mkdtemp(path.join(os.tmpdir(), "cx-audit-test-")),
      );

      const logger = new AuditLogger(tmpDir, true);

      await logger.logEvent(
        "workspace_list",
        "read",
        "allowed",
        "Tool workspace_list (capability: read) is allowed",
        {
          filePath: "/src/utils",
          policyName: "default-deny-mutate",
          decisionBasis: ["tool_catalog", "policy_allow_list"],
        },
      );

      const events = await logger.readLog();
      expect(events.length).toBe(1);

      const event = events[0];
      expect(event?.tool).toBe("workspace_list");
      expect(event?.traceId).toContain("workspace_list:read:allowed:");
      expect(event?.capability).toBe("read");
      expect(event?.decision).toBe("allowed");
      expect(event?.path).toBe("/src/utils");
      expect(event?.policyName).toBe("default-deny-mutate");
      expect(event?.decisionBasis).toEqual([
        "tool_catalog",
        "policy_allow_list",
      ]);
      expect(event?.timestamp).toBeDefined();

      // Cleanup
      await import("node:fs/promises").then((fs) =>
        fs.rm(tmpDir, { recursive: true, force: true }),
      );
    });

    it("handles disabled audit logging gracefully", async () => {
      const tmpDir = await import("node:fs/promises").then((fs) =>
        fs.mkdtemp(path.join(os.tmpdir(), "cx-audit-test-")),
      );

      const logger = new AuditLogger(tmpDir, false);

      await logger.logEvent("notes_new", "mutate", "denied", "Access denied");

      const events = await logger.readLog();
      expect(events.length).toBe(0);

      // Cleanup
      await import("node:fs/promises").then((fs) =>
        fs.rm(tmpDir, { recursive: true, force: true }),
      );
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
        await logger.logEvent("list", "read", "allowed", "ok");
      } finally {
        await fs.rm(tmpDir, { recursive: true, force: true });
      }

      expect(capture.stderr()).toContain("Warning: Failed to write audit log");
      expect(await logger.readLog()).toEqual([]);
    });
  });

  describe("logToolAccess", () => {
    it("logs allowed access", async () => {
      const tmpDir = await import("node:fs/promises").then((fs) =>
        fs.mkdtemp(path.join(os.tmpdir(), "cx-audit-test-")),
      );

      const logger = new AuditLogger(tmpDir, true);

      await logger.logToolAccess(
        "doctor_mcp",
        "observe",
        true,
        "Tool allowed under policy",
        {
          policyName: "default-deny-mutate",
          decisionBasis: ["tool_catalog", "policy_allow_list"],
        },
      );

      const events = await logger.readLog();
      expect(events.length).toBe(1);
      expect(events[0]?.decision).toBe("allowed");
      expect(events[0]?.policyName).toBe("default-deny-mutate");

      // Cleanup
      await import("node:fs/promises").then((fs) =>
        fs.rm(tmpDir, { recursive: true, force: true }),
      );
    });

    it("logs denied access", async () => {
      const tmpDir = await import("node:fs/promises").then((fs) =>
        fs.mkdtemp(path.join(os.tmpdir(), "cx-audit-test-")),
      );

      const logger = new AuditLogger(tmpDir, true);

      await logger.logToolAccess(
        "notes_delete",
        "mutate",
        false,
        "Tool denied by policy",
      );

      const events = await logger.readLog();
      expect(events.length).toBe(1);
      expect(events[0]?.decision).toBe("denied");

      // Cleanup
      await import("node:fs/promises").then((fs) =>
        fs.rm(tmpDir, { recursive: true, force: true }),
      );
    });
  });

  describe("getSummary", () => {
    it("computes correct summary statistics", async () => {
      const tmpDir = await import("node:fs/promises").then((fs) =>
        fs.mkdtemp(path.join(os.tmpdir(), "cx-audit-test-")),
      );

      const logger = new AuditLogger(tmpDir, true);

      // Log various events
      await logger.logToolAccess("workspace_list", "read", true, "allowed");
      await logger.logToolAccess("workspace_grep", "read", true, "allowed");
      await logger.logToolAccess("bundle", "plan", true, "allowed");
      await logger.logToolAccess("notes_new", "mutate", false, "denied");
      await logger.logToolAccess("notes_update", "mutate", false, "denied");

      const summary = await logger.getSummary();

      expect(summary.totalEvents).toBe(5);
      expect(summary.allowedCount).toBe(3);
      expect(summary.deniedCount).toBe(2);
      expect(summary.byCapability.read).toBe(2);
      expect(summary.byCapability.plan).toBe(1);
      expect(summary.byCapability.mutate).toBe(2);
      expect(summary.byCapability.observe).toBe(0);
      expect(summary.byPolicyName["unknown-policy"]).toBe(5);
      expect(summary.recentTraceIds).toHaveLength(5);

      // Cleanup
      await import("node:fs/promises").then((fs) =>
        fs.rm(tmpDir, { recursive: true, force: true }),
      );
    });

    it("handles empty audit log", async () => {
      const tmpDir = await import("node:fs/promises").then((fs) =>
        fs.mkdtemp(path.join(os.tmpdir(), "cx-audit-test-")),
      );

      const logger = new AuditLogger(tmpDir, true);

      const summary = await logger.getSummary();

      expect(summary.totalEvents).toBe(0);
      expect(summary.allowedCount).toBe(0);
      expect(summary.deniedCount).toBe(0);
      expect(summary.byPolicyName).toEqual({});
      expect(summary.recentTraceIds).toEqual([]);

      // Cleanup
      await import("node:fs/promises").then((fs) =>
        fs.rm(tmpDir, { recursive: true, force: true }),
      );
    });
  });

  describe("clear", () => {
    it("removes the audit log file", async () => {
      const fs = await import("node:fs/promises");
      const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "cx-audit-test-"));

      const logger = new AuditLogger(tmpDir, true);
      await logger.logToolAccess("workspace_list", "read", true, "allowed");

      expect((await logger.readLog()).length).toBe(1);

      await logger.clear();

      await expect(logger.readLog()).resolves.toEqual([]);
      await expect(fs.access(logger.getLogPath())).rejects.toThrow();

      await fs.rm(tmpDir, { recursive: true, force: true });
    });
  });

  describe("Audit Trail Integrity", () => {
    it("records timestamp for each event", async () => {
      const tmpDir = await import("node:fs/promises").then((fs) =>
        fs.mkdtemp(path.join(os.tmpdir(), "cx-audit-test-")),
      );

      const logger = new AuditLogger(tmpDir, true);
      const before = new Date();

      await logger.logToolAccess("workspace_list", "read", true, "allowed");

      const after = new Date();
      const events = await logger.readLog();

      expect(events[0]?.timestamp).toBeDefined();
      const timestamp = events[0]?.timestamp;
      if (timestamp === undefined) throw new Error("timestamp undefined");
      const eventTime = new Date(timestamp);
      expect(eventTime.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(eventTime.getTime()).toBeLessThanOrEqual(after.getTime());

      // Cleanup
      await import("node:fs/promises").then((fs) =>
        fs.rm(tmpDir, { recursive: true, force: true }),
      );
    });

    it("preserves all event data across read/write cycles", async () => {
      const tmpDir = await import("node:fs/promises").then((fs) =>
        fs.mkdtemp(path.join(os.tmpdir(), "cx-audit-test-")),
      );

      const logger = new AuditLogger(tmpDir, true);

      await logger.logEvent(
        "notes_new",
        "mutate",
        "denied",
        "Custom reason for denial",
        {
          filePath: "/notes/important",
          policyName: "default-deny-mutate",
          decisionBasis: ["tool_catalog", "policy_deny_list"],
        },
      );

      const events = await logger.readLog();
      expect(events.length).toBe(1);

      const event = events[0];
      expect(event?.tool).toBe("notes_new");
      expect(event?.capability).toBe("mutate");
      expect(event?.decision).toBe("denied");
      expect(event?.reason).toBe("Custom reason for denial");
      expect(event?.path).toBe("/notes/important");
      expect(event?.policyName).toBe("default-deny-mutate");
      expect(event?.decisionBasis).toEqual([
        "tool_catalog",
        "policy_deny_list",
      ]);

      // Cleanup
      await import("node:fs/promises").then((fs) =>
        fs.rm(tmpDir, { recursive: true, force: true }),
      );
    });
  });
});
