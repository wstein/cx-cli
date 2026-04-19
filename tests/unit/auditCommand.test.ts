// test-lane: unit
import { describe, expect, test } from "bun:test";
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
          byPolicyName: {},
          recentTraceIds: [],
        }),
      },
    );

    expect(exitCode).toBe(0);
    expect(capture.stdout()).toContain("/repo/.cx/audit.log");
    expect(capture.stdout()).toContain("Events: 0");
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
          byPolicyName: {
            "default-deny-mutate": 3,
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
          byPolicyName: {
            "default-deny-mutate": 1,
          },
          recentTraceIds: ["trace-1"],
        }),
      },
    );

    expect(exitCode).toBe(0);
    expect(capture.stdout()).toContain("/repo/worktree/.cx/audit.log");
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
