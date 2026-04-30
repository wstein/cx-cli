// test-lane: unit
import { describe, expect, it } from "vitest";

import {
  enforceToolAccess,
  withPolicyEnforcement,
} from "../../src/mcp/enforce.js";
import { DEFAULT_POLICY } from "../../src/mcp/policy.js";

const READ_TOOL = {
  name: "list",
  capability: "read",
  stability: "STABLE",
} as const;

const MUTATE_TOOL = {
  name: "notes_new",
  capability: "mutate",
  stability: "STABLE",
} as const;

describe("enforceToolAccess", () => {
  it("executes the handler when policy allows the tool", async () => {
    const result = await enforceToolAccess(
      READ_TOOL,
      async () => "ok",
      DEFAULT_POLICY,
    );
    expect(result).toBe("ok");
  });

  it("throws when policy denies the tool", async () => {
    await expect(
      enforceToolAccess(MUTATE_TOOL, async () => "never", DEFAULT_POLICY),
    ).rejects.toThrow("Access denied");
  });
});

describe("withPolicyEnforcement", () => {
  it("passes args through to the wrapped handler", async () => {
    const wrapped = withPolicyEnforcement(
      READ_TOOL,
      async (args) => args.value,
      DEFAULT_POLICY,
    );

    await expect(wrapped({ value: "kept" })).resolves.toBe("kept");
  });
});
