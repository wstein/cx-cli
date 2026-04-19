// test-lane: unit
import { describe, expect, it } from "vitest";

import { jsonToolResult } from "../../src/mcp/tools/utils.js";

describe("jsonToolResult", () => {
  it("wraps JSON output as MCP text content", () => {
    const result = jsonToolResult({ ok: true, count: 2 });

    expect(result.content).toHaveLength(1);
    expect(result.content[0]).toEqual({
      type: "text",
      text: '{\n  "ok": true,\n  "count": 2\n}\n',
    });
  });
});
