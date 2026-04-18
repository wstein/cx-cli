import { describe, expect, test } from "bun:test";
import { generateTemplateWorkspace } from "./templateHarness.js";

describe("zig init template", () => {
  test("adds zig support end-to-end", async () => {
    const project = await generateTemplateWorkspace({
      template: "zig",
      projectName: "zig-demo",
      files: {
        "build.zig": 'const std = @import("std");\n',
      },
    });

    expect(project.exitCode).toBe(0);
    expect(project.capture.logs()).toContain("Created Makefile");
    const makefile = await project.read("Makefile");
    const overlay = await project.read("cx-mcp.toml");
    expect(makefile).toContain("$(ZIG) build");
    expect(makefile).toContain("$(ZIG) build test");
    expect(makefile).toContain("certify:");
    expect(overlay).toContain('"build.zig"');
    expect(overlay).toContain('"src/**"');
  });
});
