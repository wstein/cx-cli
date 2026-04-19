// test-lane: integration
import { describe, expect, test } from "vitest";
import { generateTemplateWorkspace } from "./templateHarness.js";

describe("elixir init template", () => {
  test("generates enhanced make targets and source-first MCP overlay", async () => {
    const project = await generateTemplateWorkspace({
      template: "elixir",
      projectName: "elixir-demo",
      files: {
        "mix.exs": "defmodule Demo.MixProject do\nend\n",
      },
    });

    expect(project.exitCode).toBe(0);
    expect(project.capture.logs()).toContain("Created cx-mcp.toml");
    const makefile = await project.read("Makefile");
    const overlay = await project.read("cx-mcp.toml");
    expect(makefile).toContain("check:");
    expect(makefile).toContain("verify:");
    expect(makefile).toContain("certify:");
    expect(overlay).toContain('"lib/**"');
    expect(overlay).toContain('"test/**"');
    expect(await project.exists("cx-mcp-build.toml")).toBe(false);
  });
});
