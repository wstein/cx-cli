// test-lane: integration
import { describe, expect, test } from "vitest";
import { generateTemplateWorkspace } from "./templateHarness.js";

describe("go init template", () => {
  test("generates go quality targets and source-first overlay", async () => {
    const project = await generateTemplateWorkspace({
      template: "go",
      projectName: "go-demo",
      files: {
        "go.mod": "module example.com/demo\n\ngo 1.24\n",
      },
    });

    expect(project.exitCode).toBe(0);
    const makefile = await project.read("Makefile");
    const overlay = await project.read("cx-mcp.toml");
    expect(makefile).toContain("$(GO) vet ./...");
    expect(makefile).toContain("verify:");
    expect(makefile).toContain("certify:");
    expect(overlay).toContain('"cmd/**"');
    expect(overlay).toContain('"internal/**"');
    expect(await project.exists("cx-mcp-build.toml")).toBe(false);
  });
});
