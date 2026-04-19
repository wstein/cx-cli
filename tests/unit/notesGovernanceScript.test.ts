// test-lane: unit
import { describe, expect, test } from "bun:test";

import {
  createNotesGovernanceInvocation,
  runNotesGovernance,
  runNotesGovernanceEntry,
} from "../../scripts/notes-governance.js";

describe("notes governance script", () => {
  test("creates the direct notes-check invocation", () => {
    expect(createNotesGovernanceInvocation("/tmp/cx-notes")).toEqual({
      command: "bun",
      args: ["run", "src/cli/main.ts", "notes", "check"],
      cwd: "/tmp/cx-notes",
    });
  });

  test("runs notes governance with inherit stdio", async () => {
    const execaCalls: Array<{
      command: string;
      args: string[];
      options: Record<string, unknown>;
    }> = [];
    const logs: string[] = [];

    await runNotesGovernance("/tmp/cx-notes", {
      baseEnv: { CI: "true" },
      execaImpl: async (command, args, options) => {
        execaCalls.push({ command, args, options });
      },
      log: (message) => {
        logs.push(message);
      },
    });

    expect(execaCalls).toEqual([
      {
        command: "bun",
        args: ["run", "src/cli/main.ts", "notes", "check"],
        options: {
          cwd: "/tmp/cx-notes",
          stdio: "inherit",
          env: { CI: "true" },
        },
      },
    ]);
    expect(logs).toEqual(["✓ Notes governance check completed"]);
  });

  test("entry logs failures and exits 1", async () => {
    const errors: string[] = [];
    const exits: number[] = [];

    await runNotesGovernanceEntry({
      runCheck: async () => {
        throw new Error("boom");
      },
      logError: (message) => {
        errors.push(message);
      },
      exit: (code) => {
        exits.push(code);
      },
    });

    expect(errors).toEqual(["✗ Notes governance check failed: boom"]);
    expect(exits).toEqual([1]);
  });

  test("entry does not exit on success", async () => {
    const exits: number[] = [];

    await runNotesGovernanceEntry({
      runCheck: async () => {},
      exit: (code) => {
        exits.push(code);
      },
    });

    expect(exits).toEqual([]);
  });
});
