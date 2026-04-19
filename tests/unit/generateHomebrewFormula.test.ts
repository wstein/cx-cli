// test-lane: unit

import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import packageJson from "../../package.json" with { type: "json" };

const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);

describe("generate-homebrew-formula.js", () => {
  const taggedPackageVersion = `v${packageJson.version}`;

  test("emits a formula that links the npm-installed shim and exposes cx", async () => {
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
    expect(formula).toContain(
      'desc "Deterministic context bundler built on top of Repomix"',
    );
    expect(formula).not.toContain(
      'desc "Deterministic context bundler built on top of Repomix."',
    );
    expect(formula).toContain('depends_on "node"');
    expect(formula).toContain('system "npm",');
    expect(formula).toContain('"--no-fund"');
    expect(formula).toContain('libexec.install Dir["*"]');
    expect(formula).toContain('bin.install_symlink libexec/"bin/cx" => "cx"');
    expect(formula).toContain('bin.install_symlink libexec/"bin/cx"');
    expect(formula).toContain('shell_output("#{bin}/cx --help")');
    expect(formula).not.toContain('"--prefix=#{libexec}"');
    expect(formula).not.toContain("node_modules/.bin/cx-cli");
    expect(formula).not.toContain('Dir["#{libexec}/bin/*"]');
    expect(formula).not.toContain("Language::Node");
    expect(formula).not.toContain("std_npm_install_args");
  });

  test("accepts a v-prefixed version argument", async () => {
    const tempRoot = await fs.mkdtemp(
      path.join(os.tmpdir(), "cx-homebrew-formula-versioned-"),
    );
    const outputPath = path.join(tempRoot, "cx-cli.rb");

    const result = spawnSync(
      "node",
      [
        path.join(ROOT, "scripts", "generate-homebrew-formula.js"),
        taggedPackageVersion,
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
    expect(formula).toContain(
      `url "https://registry.npmjs.org/@wsmy/cx-cli/-/cx-cli-${packageJson.version}.tgz"`,
    );
  });
});
