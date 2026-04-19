// test-lane: contract
import { describe, expect, test } from "bun:test";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);

describe("PR template contract", () => {
  test("retains lane checklist bullets", async () => {
    const template = await fs.readFile(
      path.join(ROOT, ".github/pull_request_template.md"),
      "utf8",
    );

    expect(template).toContain("## Testing Strategy Checklist");
    expect(template).toContain("Unit coverage updated for pure logic changes");
    expect(template).toContain(
      "Integration coverage updated for real boundary behavior",
    );
    expect(template).toContain(
      "Adversarial coverage updated for degraded or hostile boundary conditions",
    );
    expect(template).toContain(
      "declare a lane header (`// test-lane: ...`) that matches `tests/README.md`",
    );
  });
});
