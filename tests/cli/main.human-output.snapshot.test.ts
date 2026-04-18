import { describe, expect, test } from "bun:test";
import path from "node:path";
import packageJson from "../../package.json" with { type: "json" };
import { main } from "../../src/cli/main.js";
import { captureCli } from "../helpers/cli/captureCli.js";
import { assertTextSnapshot } from "../helpers/snapshot/assertSnapshot.js";
import { scrubTextSnapshot } from "../helpers/snapshot/scrubbers.js";

describe("main human snapshot lane", () => {
  test("top-level help snapshot", async () => {
    const result = await captureCli({
      run: () => main([]),
    });
    expect(result.exitCode).toBe(0);
    const scrubbed = scrubTextSnapshot(result.stdout, {
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
    const result = await captureCli({
      run: () => main(["init", "--stdout"]),
    });
    expect(result.exitCode).toBe(0);
    const scrubbed = scrubTextSnapshot(result.stdout);
    await assertTextSnapshot({
      snapshotPath: path.join(
        process.cwd(),
        "tests/fixtures/snapshots/cli/main-init-stdout-human.txt",
      ),
      actual: scrubbed,
    });
  });

  test("prints CLI version", async () => {
    const result = await captureCli({
      run: () => main(["--version"]),
    });
    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe(packageJson.version);
  });
});
