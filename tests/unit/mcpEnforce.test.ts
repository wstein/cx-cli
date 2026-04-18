// test-lane: unit
import { describe, expect, it } from "bun:test";
import {
  enforceToolAccess,
  withPolicyEnforcement,
} from "../../src/mcp/enforce.js";
import { DEFAULT_POLICY, STRICT_POLICY } from "../../src/mcp/policy.js";
import type { CxMcpToolDefinition } from "../../src/mcp/tools/catalog.js";

const BUNDLE_TOOL: CxMcpToolDefinition = {
  name: "bundle",
  capability: "plan",
};

const NOTES_NEW_TOOL: CxMcpToolDefinition = {
  name: "notes_new",
  capability: "mutate",
};

describe("MCP enforcement", () => {
  it("enforces access from the passed tool definition", async () => {
    await expect(
      enforceToolAccess(BUNDLE_TOOL, async () => "ok", DEFAULT_POLICY),
    ).resolves.toBe("ok");
  });

  it("denies access from the passed tool definition", async () => {
    await expect(
      enforceToolAccess(NOTES_NEW_TOOL, async () => "nope", DEFAULT_POLICY),
    ).rejects.toThrow("Access denied");
  });

  it("wraps handlers without re-looking up capability by name", async () => {
    const handler = withPolicyEnforcement(
      BUNDLE_TOOL,
      async () => ({
        ok: true,
      }),
      STRICT_POLICY,
    );

    await expect(handler({})).rejects.toThrow("capability: plan");
  });
});
