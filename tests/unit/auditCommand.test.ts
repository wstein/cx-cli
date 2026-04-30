// test-lane: unit
import { describe, expect, test } from "vitest";
import { runAuditCommand } from "../../src/cli/commands/audit.js";
import { CxError } from "../../src/shared/errors.js";
import { createBufferedCommandIo } from "../helpers/cli/createBufferedCommandIo.js";
import { parseJsonOutput } from "../helpers/cli/parseJsonOutput.js";

describe("runAuditCommand", () => {
  test("prints a compact text summary when no audit events exist", async () => {
    const capture = createBufferedCommandIo({ cwd: "/repo" });
    const exitCode = await runAuditCommand(
      { subcommand: "summary" },
      capture.io,
      {
        configExists: async () => false,
        readAuditSummary: async () => ({
          totalEvents: 0,
          allowedCount: 0,
          deniedCount: 0,
          byCapability: {
            read: 0,
            observe: 0,
            plan: 0,
            mutate: 0,
          },
          byAgentReasonPresence: {
            missing: 0,
            provided: 0,
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
        }),
      },
    );

    expect(exitCode).toBe(0);
    expect(capture.stdout()).toContain("/repo/.cx/audit.log");
    expect(capture.stdout()).toContain("Events: 0");
    expect(capture.stdout()).toContain("By execution status:");
    expect(capture.stdout()).toContain("Agent reason coverage:");
    expect(capture.stdout()).toContain("(no audit events)");
  });

  test("writes JSON output when requested", async () => {
    const capture = createBufferedCommandIo({ cwd: "/repo" });
    const exitCode = await runAuditCommand(
      {
        subcommand: "summary",
        json: true,
      },
      capture.io,
      {
        configExists: async () => false,
        readAuditSummary: async () => ({
          totalEvents: 3,
          allowedCount: 2,
          deniedCount: 1,
          byCapability: {
            read: 1,
            observe: 1,
            plan: 0,
            mutate: 1,
          },
          byAgentReasonPresence: {
            missing: 1,
            provided: 2,
          },
          byExecutionStatus: {
            denied: 1,
            failed: 1,
            succeeded: 1,
            timed_out: 0,
          },
          byPolicyName: {
            "default-deny-mutate": 3,
          },
          byRedactionRule: {
            binary_or_blob: 0,
            body_text: 1,
            large_freeform_text: 0,
            prompt_like_input: 0,
            secret_like_key: 1,
          },
          recentTraceIds: ["trace-3", "trace-2"],
        }),
      },
    );
    const payload = parseJsonOutput<Record<string, unknown>>(capture.stdout());

    expect(exitCode).toBe(0);
    expect(payload.command).toBe("audit summary");
    expect(payload.workspaceRoot).toBe("/repo");
    expect(payload.auditLogPath).toBe("/repo/.cx/audit.log");
    expect(payload.totalEvents).toBe(3);
    expect(payload.byExecutionStatus).toEqual({
      denied: 1,
      failed: 1,
      succeeded: 1,
      timed_out: 0,
    });
    expect(payload.byAgentReasonPresence).toEqual({
      missing: 1,
      provided: 2,
    });
  });

  test("prefers config.sourceRoot when config exists", async () => {
    const capture = createBufferedCommandIo({ cwd: "/repo" });
    const exitCode = await runAuditCommand(
      {
        subcommand: "summary",
        config: "/repo/cx.toml",
      },
      capture.io,
      {
        configExists: async () => true,
        loadConfig: async () =>
          ({
            sourceRoot: "/repo/worktree",
          }) as never,
        readAuditSummary: async () => ({
          totalEvents: 1,
          allowedCount: 1,
          deniedCount: 0,
          byCapability: {
            read: 1,
            observe: 0,
            plan: 0,
            mutate: 0,
          },
          byAgentReasonPresence: {
            missing: 0,
            provided: 1,
          },
          byExecutionStatus: {
            denied: 0,
            failed: 0,
            succeeded: 1,
            timed_out: 0,
          },
          byPolicyName: {
            "default-deny-mutate": 1,
          },
          byRedactionRule: {
            binary_or_blob: 0,
            body_text: 0,
            large_freeform_text: 0,
            prompt_like_input: 0,
            secret_like_key: 0,
          },
          recentTraceIds: ["trace-1"],
        }),
      },
    );

    expect(exitCode).toBe(0);
    expect(capture.stdout()).toContain("/repo/worktree/.cx/audit.log");
  });

  test("prints recent sanitized audit events in human format", async () => {
    const capture = createBufferedCommandIo({ cwd: "/repo" });
    const exitCode = await runAuditCommand(
      {
        subcommand: "recent",
        limit: 2,
        traceId: "trace-2",
      },
      capture.io,
      {
        configExists: async () => false,
        readRecentAuditEvents: async () => ({
          limit: 2,
          events: [
            {
              schemaVersion: 2,
              timestamp: "2026-04-30T17:00:00.000Z",
              traceId: "trace-2",
              sessionId: "mcp-session-1",
              requestId: "req-000002",
              tool: "notes_update",
              capability: "mutate",
              path: "notes/A.md",
              decision: "allowed",
              reason: "allowed",
              policyName: "unrestricted",
              decisionBasis: ["tool_catalog", "policy_allow_list"],
              request: {
                agentReason: "Update the note body.",
                args: {
                  body: {
                    kind: "redacted_text",
                    sha256: "abc",
                    length: 10,
                    preview: "hello",
                  },
                  id: "123",
                },
                redaction: {
                  applied: true,
                  rules: ["body_text"],
                },
                userGoal: "Refresh the note.",
              },
              execution: {
                durationMs: 18,
                status: "succeeded",
              },
            },
          ],
        }),
      },
    );

    expect(exitCode).toBe(0);
    expect(capture.stdout()).toContain("Recent audit events:");
    expect(capture.stdout()).toContain("Trace filter: trace-2");
    expect(capture.stdout()).toContain(
      "trace-2 | notes_update | allowed/succeeded",
    );
    expect(capture.stdout()).toContain("reason=Update the note body.");
    expect(capture.stdout()).toContain('"id": "123"');
  });

  test("writes recent audit events as JSON when requested", async () => {
    const capture = createBufferedCommandIo({ cwd: "/repo" });
    const exitCode = await runAuditCommand(
      {
        subcommand: "recent",
        json: true,
        limit: 1,
        sessionId: "mcp-session-1",
      },
      capture.io,
      {
        configExists: async () => false,
        readRecentAuditEvents: async () => ({
          limit: 1,
          events: [
            {
              schemaVersion: 2,
              timestamp: "2026-04-30T17:00:00.000Z",
              traceId: "trace-1",
              sessionId: "mcp-session-1",
              requestId: "req-000001",
              tool: "read",
              capability: "read",
              decision: "allowed",
              reason: "allowed",
              policyName: "default-deny-mutate",
              decisionBasis: ["tool_catalog", "policy_allow_list"],
              request: {
                agentReason: "(not provided)",
                args: {
                  path: "src/index.ts",
                },
                redaction: {
                  applied: false,
                  rules: [],
                },
              },
              execution: {
                status: "succeeded",
              },
            },
          ],
        }),
      },
    );
    const payload = parseJsonOutput<Record<string, unknown>>(capture.stdout());

    expect(exitCode).toBe(0);
    expect(payload.command).toBe("audit recent");
    expect(payload.limit).toBe(1);
    expect(payload.sessionId).toBe("mcp-session-1");
    expect(Array.isArray(payload.events)).toBe(true);
  });

  test("rejects unknown audit subcommands", async () => {
    await expect(
      runAuditCommand({
        // biome-ignore lint/suspicious/noExplicitAny: intentional invalid value for test
        subcommand: "bogus" as any,
      }),
    ).rejects.toThrow(CxError);
  });
});
