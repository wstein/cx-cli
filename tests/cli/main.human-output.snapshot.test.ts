import { describe, expect, test } from "bun:test";
import path from "node:path";
import packageJson from "../../package.json" with { type: "json" };
import { main } from "../../src/cli/main.js";
import { assertTextSnapshot } from "../helpers/snapshot/assertSnapshot.js";
import { scrubTextSnapshot } from "../helpers/snapshot/scrubbers.js";

function captureStdout(): { restore: () => void; output: () => string } {
  const write = process.stdout.write;
  let output = "";
  process.stdout.write = ((chunk: string | Uint8Array) => {
    output += String(chunk);
    return true;
  }) as typeof process.stdout.write;
  return {
    restore: () => {
      process.stdout.write = write;
    },
    output: () => output,
  };
}

describe("main human snapshot lane", () => {
  test("top-level help snapshot", async () => {
    const capture = captureStdout();
    try {
      await expect(main([])).resolves.toBe(0);
    } finally {
      capture.restore();
    }
    const scrubbed = scrubTextSnapshot(capture.output(), {
      stripVersions: true,
    });
    await assertTextSnapshot({
      snapshotPath: path.join(
        process.cwd(),
        "tests/fixtures/snapshots/cli/main-help-human.txt",
      ),
      actual: scrubbed,
    });
  });

  test("init stdout snapshot", async () => {
    const capture = captureStdout();
    try {
      await expect(main(["init", "--stdout"])).resolves.toBe(0);
    } finally {
      capture.restore();
    }
    const scrubbed = scrubTextSnapshot(capture.output());
    await assertTextSnapshot({
      snapshotPath: path.join(
        process.cwd(),
        "tests/fixtures/snapshots/cli/main-init-stdout-human.txt",
      ),
      actual: scrubbed,
    });
  });

  test("prints CLI version", async () => {
    const capture = captureStdout();
    try {
      await expect(main(["--version"])).resolves.toBe(0);
    } finally {
      capture.restore();
    }
    expect(capture.output().trim()).toBe(packageJson.version);
  });
});
