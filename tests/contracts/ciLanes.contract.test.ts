// test-lane: contract
import { describe, expect, test } from "bun:test";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { collectTestFiles } from "../../scripts/test-lane-policy.js";

const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);

async function readText(relativePath: string): Promise<string> {
  return fs.readFile(path.join(ROOT, relativePath), "utf8");
}

describe("CI lanes contract", () => {
  test("workflow test lanes invoke script-backed Bun commands", async () => {
    const workflow = await readText(".github/workflows/ci.yml");

    expect(workflow).toContain("run: bun run ci:test:fast");
    expect(workflow).toContain(
      "run: bun run lint && bun run format:check && bun run check",
    );
    expect(workflow).toContain("run: bun run ci:test:all");
    expect(workflow).toContain("run: bun run ci:test:contracts");
    expect(workflow).not.toContain("bun test tests --timeout");
    expect(workflow).not.toContain("bun test tests/contracts --timeout");
    expect(workflow).not.toContain("bun test tests/unit --timeout");
    expect(workflow).not.toContain("run: bun run lint && bun run check");
  });

  test("package scripts use deterministic file-list discovery via test-lane.js", async () => {
    const pkgRaw = await readText("package.json");
    const pkg = JSON.parse(pkgRaw) as {
      scripts?: Record<string, string>;
    };

    const scripts = pkg.scripts ?? {};
    expect(scripts["format:check"]).toBe(
      "biome check --formatter-enabled=true --linter-enabled=false --assist-enabled=false .",
    );
    expect(scripts["test:unit"]).toContain(
      "node scripts/test-lane.js ./tests/unit",
    );
    expect(scripts["test:all"]).toContain("node scripts/test-lane.js ./tests");
    expect(scripts["test:contracts"]).toContain(
      "node scripts/test-lane.js ./tests/contracts",
    );
    expect(scripts["ci:test:fast"]).toBe("bun run test:unit");
    expect(scripts["ci:test:all"]).toBe("bun run test:all");
    expect(scripts["ci:test:contracts"]).toBe("bun run test:contracts");

    // shell find must not survive in any test-discovery script
    expect(scripts["test:unit"]).not.toContain("find ./tests");
    expect(scripts["test:all"]).not.toContain("find ./tests");
    expect(scripts["test:contracts"]).not.toContain("find ./tests");
  });

  test("CI reproducibility job delegates to a reproducibility assurance wrapper", async () => {
    const workflow = await readText(".github/workflows/ci.yml");

    expect(workflow).toContain("run: bun run ci:assurance:reproducibility");
    // inline hash-capture steps must not remain in the workflow
    expect(workflow).not.toContain("sha256sum");
    expect(workflow).not.toContain("build1.sha256");
  });

  test("CI workflow exposes an explicit release-assurance job", async () => {
    const workflow = await readText(".github/workflows/ci.yml");

    expect(workflow).toContain("release-assurance:");
    expect(workflow).toContain("run: bun run ci:assurance:release-integrity");
  });

  test("repomix matrix installs known-good fork versions", async () => {
    const workflow = await readText(".github/workflows/ci.yml");

    expect(workflow).toContain(
      `@wsmy/repomix-cx-fork@\${{ matrix.repomix-version }}`,
    );
    expect(workflow).toContain(
      'repomix-version: ["1.13.1-cx.1", "1.13.1-cx.3", "1.13.1-cx.4"]',
    );
    expect(workflow).not.toContain("bun add --exact repomix@");
  });

  test("fast lane test discovery includes bundle failure-class unit suites", () => {
    const files = collectTestFiles(path.join(ROOT, "tests"))
      .map((fullPath) =>
        path.relative(ROOT, fullPath).split(path.sep).join("/"),
      )
      .sort();

    expect(files).toContain("tests/unit/bundleValidateFailures.test.ts");
    expect(files).toContain("tests/unit/bundleVerifyFailures.test.ts");
  });
});
