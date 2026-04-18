import { describe, expect, test } from "bun:test";
import { generateTemplateWorkspace } from "./templateHarness.js";

describe("rust init template", () => {
  test("generates richer rust verification targets and authoring overlay", async () => {
    const project = await generateTemplateWorkspace({
      template: "rust",
      projectName: "rust-demo",
      files: {
        "Cargo.toml": '[package]\nname = "rust-demo"\nversion = "0.1.0"\n',
      },
    });

    expect(project.exitCode).toBe(0);
    const makefile = await project.read("Makefile");
    const overlay = await project.read("cx-mcp.toml");
    expect(makefile).toContain("$(CARGO) fmt --check");
    expect(makefile).toContain("$(CARGO) clippy --all-targets -- -D warnings");
    expect(makefile).toContain("certify:");
    expect(overlay).toContain('"src/**"');
    expect(overlay).toContain('"Cargo.toml"');
    expect(await project.exists("cx-mcp-build.toml")).toBe(false);
  });
});
