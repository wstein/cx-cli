// test-lane: unit
import { describe, expect, test } from "bun:test";
import { z } from "zod";

import {
  resolveCommandIo,
  writeLog,
  writeStderr,
  writeStdout,
  writeValidatedJson,
} from "../../src/shared/output.js";
import { createBufferedCommandIo } from "../helpers/cli/createBufferedCommandIo.js";

describe("command I/O edge cases", () => {
  test("resolveCommandIo preserves explicit overrides and leaves defaults for the rest", () => {
    const capture = createBufferedCommandIo();
    const env = { CX_TEST_ENV: "edge-case" };
    const stdin = { isTTY: false };
    const cwd = "/tmp/cx-edge-case";

    const resolved = resolveCommandIo({
      stdout: capture.io.stdout,
      stderr: capture.io.stderr,
      log: capture.io.log,
      env,
      stdin,
      cwd,
    });

    expect(resolved.stdout).toBe(capture.io.stdout);
    expect(resolved.stderr).toBe(capture.io.stderr);
    expect(resolved.log).toBe(capture.io.log);
    expect(resolved.env).toBe(env);
    expect(resolved.stdin).toBe(stdin);
    expect(resolved.cwd).toBe(cwd);
  });

  test("writeStdout and writeStderr route multiline unicode text to separate streams", () => {
    const capture = createBufferedCommandIo();
    const stdoutText = "stdout line 1\nstdout line 2 🚀\n";
    const stderrText = "stderr line 1\nstderr line 2 ⚠\n";

    writeStdout(stdoutText, capture.io);
    writeStderr(stderrText, capture.io);

    expect(capture.stdout()).toBe(stdoutText);
    expect(capture.stderr()).toBe(stderrText);
    expect(capture.logs()).toBe("");
  });

  test("writeLog uses the logger channel without mutating stdout or stderr", () => {
    const capture = createBufferedCommandIo();

    writeLog("operator-facing message", capture.io);

    expect(capture.logs()).toBe("operator-facing message");
    expect(capture.stdout()).toBe("");
    expect(capture.stderr()).toBe("");
  });
});

describe("validated JSON output edge cases", () => {
  test("writeValidatedJson writes parsed JSON for valid payloads", () => {
    const capture = createBufferedCommandIo();
    const schema = z.object({
      id: z.string().min(1),
      count: z.number().int().nonnegative(),
    });

    writeValidatedJson(schema, { id: "abc", count: 2 }, capture.io);

    expect(capture.stdout()).toBe(
      `${JSON.stringify({ id: "abc", count: 2 }, null, 2)}\n`,
    );
  });

  test("writeValidatedJson rejects invalid payloads and emits no partial output", () => {
    const capture = createBufferedCommandIo();
    const schema = z.object({
      id: z.string().min(1),
      count: z.number().int().nonnegative(),
    });

    expect(() =>
      writeValidatedJson(schema, { id: "", count: -1 }, capture.io),
    ).toThrow();
    expect(capture.stdout()).toBe("");
  });
});
