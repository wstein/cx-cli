// test-lane: contract
import { describe, expect, test } from "vitest";
import { validateTestLaneHeaders } from "../../scripts/test-lane-policy.js";

describe("test lane headers", () => {
  test("all test files declare and match their lane headers", () => {
    const { mismatches } = validateTestLaneHeaders();
    expect(mismatches).toEqual([]);
  });
});
