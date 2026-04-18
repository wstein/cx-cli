// test-lane: integration
import { describe, expect, test } from "bun:test";
import { generateTemplateWorkspace } from "./templateHarness.js";

describe("crystal init template", () => {
  test("generates crystal-specific build/test wrappers and overlay", async () => {
    const project = await generateTemplateWorkspace({
      template: "crystal",
      projectName: "crystal-demo",
      files: {
        "shard.yml": "name: crystal-demo\nversion: 0.1.0\n",
      },
    });

    expect(project.exitCode).toBe(0);
    const makefile = await project.read("Makefile");
    const overlay = await project.read("cx-mcp.toml");
    expect(makefile).toContain("$(SHARDS) build");
    expect(makefile).toContain("verify:");
    expect(makefile).toContain("certify:");
    expect(overlay).toContain('"src/**"');
    expect(overlay).toContain('"spec/**"');
    expect(await project.exists("cx-mcp-build.toml")).toBe(false);
  });
});
