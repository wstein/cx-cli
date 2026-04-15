import { describe, expect, test } from "bun:test";

import { writeJson } from "../../src/shared/output.js";

describe("shared output utilities", () => {
  test("writeJson writes pretty JSON to stdout", () => {
    const originalWrite = process.stdout.write;
    let output = "";
    process.stdout.write = ((chunk: string | Uint8Array) => {
      output += String(chunk);
      return true;
    }) as typeof process.stdout.write;

    try {
      writeJson({ hello: "world", value: 42 });
      expect(output).toBe(
        `${JSON.stringify({ hello: "world", value: 42 }, null, 2)}\n`,
      );
    } finally {
      process.stdout.write = originalWrite;
    }
  });
});