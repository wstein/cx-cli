// test-lane: unit
import { describe, expect, test } from "bun:test";

import { writeJson } from "../../src/shared/output.js";
import { createBufferedCommandIo } from "../helpers/cli/createBufferedCommandIo.js";

describe("shared output utilities", () => {
  test("writeJson writes pretty JSON to stdout", () => {
    const capture = createBufferedCommandIo();

    writeJson({ hello: "world", value: 42 }, capture.io);

    expect(capture.stdout()).toBe(
      `${JSON.stringify({ hello: "world", value: 42 }, null, 2)}\n`,
    );
  });
});
