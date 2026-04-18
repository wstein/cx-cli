import { describe, expect, test } from "bun:test";
import { runDoctorCommand } from "../../src/cli/commands/doctor.js";
import { CxError } from "../../src/shared/errors.js";

describe("runDoctorCommand — argument validation", () => {
  test("throws CxError when --all and --json are both set", async () => {
    await expect(runDoctorCommand({ all: true, json: true })).rejects.toThrow(
      CxError,
    );
  });

  test("throws CxError when no subcommand and --all is not set", async () => {
    await expect(runDoctorCommand({})).rejects.toThrow(CxError);
  });

  test("throws CxError on unknown subcommand", async () => {
    await expect(
      // biome-ignore lint/suspicious/noExplicitAny: intentional invalid value for test
      runDoctorCommand({ subcommand: "bogus" as any }),
    ).rejects.toThrow(CxError);
  });

  test("throws CxError for fix-overlaps --interactive when stdin is not a TTY", async () => {
    // process.stdin.isTTY is undefined (falsy) in the test runner
    await expect(
      runDoctorCommand({
        subcommand: "fix-overlaps",
        interactive: true,
        config: "/nonexistent/cx.toml",
      }),
    ).rejects.toThrow(CxError);
  });
});

describe("runDoctorCommand — workflow subcommand", () => {
  test("throws CxError when --task is not provided", async () => {
    await expect(runDoctorCommand({ subcommand: "workflow" })).rejects.toThrow(
      CxError,
    );
  });

  test("throws CxError when --task is only whitespace", async () => {
    await expect(
      runDoctorCommand({ subcommand: "workflow", task: "   " }),
    ).rejects.toThrow(CxError);
  });
});
