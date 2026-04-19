// test-lane: unit
import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);

describe("generate-homebrew-formula.js", () => {
  test("emits a formula that installs without Language::Node helpers", async () => {
    const tempRoot = await fs.mkdtemp(
      path.join(os.tmpdir(), "cx-homebrew-formula-"),
    );
    const outputPath = path.join(tempRoot, "cx-cli.rb");

    const result = spawnSync(
      "node",
      [
        path.join(ROOT, "scripts", "generate-homebrew-formula.js"),
        "--output",
        outputPath,
      ],
      {
        cwd: ROOT,
        encoding: "utf8",
      },
    );

    expect(result.status).toBe(0);

    const formula = await fs.readFile(outputPath, "utf8");
    expect(formula).toContain('depends_on "node"');
    expect(formula).toContain('system "npm",');
    expect(formula).toContain('"--prefix=#{libexec}"');
    expect(formula).toContain("buildpath");
    expect(formula).toContain('bin.install_symlink Dir["#{libexec}/bin/*"]');
    expect(formula).not.toContain("Language::Node");
    expect(formula).not.toContain("std_npm_install_args");
  });
});
