import { describe, expect, test } from "bun:test";

import {
  asError,
  CxError,
  formatErrorRemediation,
} from "../../src/shared/errors.js";

describe("shared error handling", () => {
  test("CxError sets message and default exit code", () => {
    const err = new CxError("Something went wrong");
    expect(err.message).toBe("Something went wrong");
    expect(err.exitCode).toBe(2);
    expect(err.name).toBe("CxError");
  });

  test("CxError accepts custom exit code", () => {
    const err = new CxError("Critical failure", 127);
    expect(err.exitCode).toBe(127);
  });

  test("CxError accepts cause in options", () => {
    const cause = new Error("Inner error");
    const err = new CxError("Outer error", 1, { cause });
    expect(err.cause).toBe(cause);
  });

  test("CxError preserves remediation metadata", () => {
    const err = new CxError("Needs guidance", 2, {
      remediation: {
        recommendedCommand: "cx inspect --config cx.toml",
        docsRef: "docs/MANUAL.md",
        nextSteps: ["Review the current plan before rebuilding."],
      },
    });

    expect(err.remediation?.recommendedCommand).toBe(
      "cx inspect --config cx.toml",
    );
    expect(formatErrorRemediation(err.remediation)).toEqual([
      "Suggested command: cx inspect --config cx.toml",
      "Docs: docs/MANUAL.md",
      "Next step: Review the current plan before rebuilding.",
    ]);
  });

  test("asError returns Error instances unchanged", () => {
    const original = new Error("test");
    const result = asError(original);
    expect(result).toBe(original);
  });

  test("asError converts non-Error values to Error", () => {
    const result1 = asError("string error");
    expect(result1).toBeInstanceOf(Error);
    expect(result1.message).toBe("string error");

    const result2 = asError(42);
    expect(result2).toBeInstanceOf(Error);
    expect(result2.message).toBe("42");

    const result3 = asError({ key: "value" });
    expect(result3).toBeInstanceOf(Error);
    expect(result3.message).toBe("[object Object]");
  });

  test("asError handles null and undefined", () => {
    const resultNull = asError(null);
    expect(resultNull).toBeInstanceOf(Error);
    expect(resultNull.message).toBe("null");

    const resultUndefined = asError(undefined);
    expect(resultUndefined).toBeInstanceOf(Error);
    expect(resultUndefined.message).toBe("undefined");
  });
});
