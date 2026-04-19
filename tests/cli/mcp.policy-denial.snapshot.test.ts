// test-lane: integration

import path from "node:path";
import { describe, expect, test } from "vitest";

import { enforceToolAccess } from "../../src/mcp/enforce.js";
import { DEFAULT_POLICY } from "../../src/mcp/policy.js";
import type { CxMcpToolDefinition } from "../../src/mcp/tools/catalog.js";
import { CxError, formatErrorRemediation } from "../../src/shared/errors.js";
import { assertTextSnapshot } from "../helpers/snapshot/assertSnapshot.js";
import { scrubTextSnapshot } from "../helpers/snapshot/scrubbers.js";

const NOTES_NEW_TOOL: CxMcpToolDefinition = {
  name: "notes_new",
  capability: "mutate",
  stability: "STABLE",
};

describe("mcp policy denial human snapshot lane", () => {
  test("mutation denial shows operator-facing remediation", async () => {
    let output = "";

    try {
      await enforceToolAccess(NOTES_NEW_TOOL, async () => "ok", DEFAULT_POLICY);
    } catch (error) {
      const resolved =
        error instanceof Error ? error : new Error(String(error));
      output = `${resolved.message}\n`;
      if (resolved instanceof CxError) {
        const remediation = formatErrorRemediation(resolved.remediation);
        if (remediation.length > 0) {
          output += `${remediation.join("\n")}\n`;
        }
      }
    }

    expect(output).toContain("Access denied");
    const scrubbed = scrubTextSnapshot(output);
    await assertTextSnapshot({
      snapshotPath: path.join(
        process.cwd(),
        "tests/fixtures/snapshots/cli/mcp-policy-denial-human.txt",
      ),
      actual: scrubbed,
    });
  });
});
