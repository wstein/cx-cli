// test-lane: contract

import { execa } from "execa";
import { describe, expect, test } from "vitest";

describe("repomix adapter parity guard", () => {
  test("installed official repomix matches the checked-in 1.13.1 adapter baseline", async () => {
    const result = await execa("node", ["scripts/repomix-adapter-parity.js"], {
      cwd: process.cwd(),
    });

    expect(result.stdout).toContain("matches repomix@1.13.1");
  });
});
