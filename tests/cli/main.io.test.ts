// test-lane: integration
import { describe, expect, test } from "bun:test";
import { main } from "../../src/cli/main.js";
import { createBufferedCommandIo } from "../helpers/cli/createBufferedCommandIo.js";

describe("main I/O injection", () => {
  test("writes shell completion through injected stdout", async () => {
    const capture = createBufferedCommandIo();
    const exitCode = await main(["completion", "--shell", "bash"], capture.io);

    expect(exitCode).toBe(0);
    expect(capture.stdout()).toContain("###-begin-cx-completions-###");
  });

  test("writes help text through injected stdout", async () => {
    const capture = createBufferedCommandIo();
    const exitCode = await main(["--help"], capture.io);

    expect(exitCode).toBe(0);
    expect(capture.stdout()).toContain(
      "Create a bundle from the current project.",
    );
  });
});
