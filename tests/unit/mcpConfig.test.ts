import { describe, expect, test } from "bun:test";
import { resolveMcpConfigPath } from "../../src/mcp/config.js";
import { CxError } from "../../src/shared/errors.js";

describe("resolveMcpConfigPath", () => {
  test("returns cx-mcp.toml path when it exists", async () => {
    const result = await resolveMcpConfigPath("/some/dir", {
      fileExists: async (p) => p.endsWith("cx-mcp.toml"),
    });
    expect(result).toContain("cx-mcp.toml");
  });

  test("falls back to cx.toml when cx-mcp.toml is absent", async () => {
    const result = await resolveMcpConfigPath("/some/dir", {
      fileExists: async (p) => p.endsWith("cx.toml"),
    });
    expect(result).toContain("cx.toml");
    expect(result).not.toContain("cx-mcp.toml");
  });

  test("throws CxError when neither config file exists", async () => {
    await expect(
      resolveMcpConfigPath("/some/dir", { fileExists: async () => false }),
    ).rejects.toThrow(CxError);
  });
});
