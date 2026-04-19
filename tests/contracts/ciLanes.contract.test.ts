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
  test("main CI workflow runs on branch pushes and pull requests, not release tags", async () => {
    const workflow = await readText(".github/workflows/ci.yml");

    expect(workflow).toContain("on:");
    expect(workflow).toContain("  push:");
    expect(workflow).toContain("    branches:");
    expect(workflow).toContain('      - "**"');
    expect(workflow).toContain("  pull_request:");
    expect(workflow).not.toContain("    tags:");
    expect(workflow).not.toContain('      - "v*"');
  });

  test("workflow test lanes invoke script-backed Bun commands", async () => {
    const workflow = await readText(".github/workflows/ci.yml");

    expect(workflow).toContain("BUN_MIN_VERSION: 1.3.11");
    expect(workflow).toContain("run: bun run ci:test:fast:monitored");
    expect(workflow).toContain(
      'cat .ci/observability-summary.md >> "$GITHUB_STEP_SUMMARY"',
    );
    expect(workflow).toContain(
      "run: bun run lint && bun run format:check && bun run check",
    );
    expect(workflow).toContain("run: bun run ci:guard:fast-lane");
    expect(workflow).toContain("Restore fast-lane timing state");
    expect(workflow).toContain("Save fast-lane timing state");
    expect(workflow).toContain(".ci/fast-lane-monitor-state.json");
    expect(workflow).toContain("run: bun run ci:test:all");
    expect(workflow).toContain("coverage-vitest:");
    expect(workflow).toContain("run: bun run ci:test:coverage");
    expect(workflow).toContain("hashFiles('.ci/coverage-summary.md') != ''");
    expect(workflow).toContain(
      'run: cat .ci/coverage-summary.md >> "$GITHUB_STEP_SUMMARY"',
    );
    expect(workflow).toContain("run: bun run ci:test:contracts");
    expect(workflow).toContain("run: bun run ci:notes:governance");
    expect(workflow).toContain("run: bun run ci:report:verify-against");
    expect(workflow).toContain("Upload verify-against policy report");
    expect(workflow).toContain(".ci/verify-against-policy-report.json");
    expect(workflow).toContain(".ci/observability-summary.json");
    expect(workflow).toContain(".ci/observability-summary.md");
    expect(workflow).toContain("coverage/vitest");
    expect(workflow).toContain(".ci/coverage-summary.md");
    expect(workflow).toContain("ci-artifacts:");
    expect(workflow).toContain("Generate Vitest coverage reports");
    expect(workflow).toContain("Upload HTML coverage report");
    expect(workflow).toContain("          name: ci-observability");
    expect(workflow).toContain("          name: coverage-html");
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
    expect(scripts["test:vitest"]).toBe("vitest run");
    expect(scripts["coverage:vitest"]).toBe("vitest run --coverage");
    expect(scripts["coverage:report"]).toBe("node scripts/coverage-report.js");
    expect(scripts["ci:test:coverage"]).toBe(
      "vitest run --coverage && node scripts/coverage-report.js",
    );
    expect(scripts["ci:test:fast"]).toBe("bun run test:unit");
    expect(scripts["ci:test:fast:monitored"]).toBe(
      "node scripts/ci-test-fast-monitored.js",
    );
    expect(scripts["ci:guard:fast-lane"]).toBe(
      "node scripts/check-fast-lane.js",
    );
    expect(scripts["ci:report:verify-against"]).toBe(
      "node scripts/verify-against-policy.js --format json --output .ci/verify-against-policy-report.json",
    );
    expect(scripts["ci:report:observability"]).toBe(
      "node scripts/ci-observability-report.js",
    );
    expect(scripts["ci:test:all"]).toBe("bun run test:all");
    expect(scripts["ci:test:contracts"]).toBe("bun run test:contracts");
    expect(scripts["ci:notes:governance"]).toBe(
      "node scripts/notes-governance.js",
    );

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

    expect(workflow).toContain("notes-governance:");
    expect(workflow).toContain("coverage-vitest:");
    expect(workflow).toContain("release-assurance:");
    expect(workflow).toContain("ci-artifacts:");
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

  test("downstream CI lanes are gated behind test-fast", async () => {
    const workflow = await readText(".github/workflows/ci.yml");

    expect(workflow).toContain("test-contracts:");
    expect(workflow).toContain("notes-governance:");
    expect(workflow).toContain("repomix-matrix:");
    expect(workflow).toContain("bun-matrix:");
    expect(workflow).toContain("coverage-vitest:");
    expect(workflow).toContain(
      "  test-contracts:\n    runs-on: ubuntu-latest\n    needs:",
    );
    expect(workflow).toContain(
      "  notes-governance:\n    runs-on: ubuntu-latest\n    needs:",
    );
    expect(workflow).toContain(
      "  repomix-matrix:\n    runs-on: ubuntu-latest\n    needs:",
    );
    expect(workflow).toContain(
      "  coverage-vitest:\n    runs-on: ubuntu-latest\n    needs:",
    );
    expect(workflow).toContain(
      "  bun-matrix:\n    runs-on: ubuntu-latest\n    needs:",
    );
    expect(workflow).toContain("      - test-fast");
    expect(workflow).toContain('bun-version: ["1.3.11", "latest"]');
    expect(workflow).toContain("bun-version: $" + "{{ env.BUN_MIN_VERSION }}");
  });

  test("CI artifacts are only uploaded after the full gate passes", async () => {
    const workflow = await readText(".github/workflows/ci.yml");

    expect(workflow).toContain("ci-artifacts:");
    expect(workflow).toContain("      - release-assurance");
    expect(workflow).toContain("Generate verify-against policy report");
    expect(workflow).toContain("Generate observability dashboard");
    expect(workflow).toContain("Generate Vitest coverage reports");
    expect(workflow).toContain("Upload verify-against policy report");
    expect(workflow).toContain("Upload observability dashboard");
    expect(workflow).toContain("Upload HTML coverage report");
    expect(workflow).not.toContain("fast-lane-observability");
    expect(workflow).not.toContain("contracts-observability");
    expect(workflow).toContain('bun-version: ["1.3.11", "latest"]');
    expect(workflow).toContain("bun-version: $" + "{{ env.BUN_MIN_VERSION }}");
  });

  test("release assurance waits for all CI matrices", async () => {
    const workflow = await readText(".github/workflows/ci.yml");

    expect(workflow).toContain("release-assurance:");
    expect(workflow).toContain("      - test-fast");
    expect(workflow).toContain("      - test-contracts");
    expect(workflow).toContain("      - notes-governance");
    expect(workflow).toContain("      - coverage-vitest");
    expect(workflow).toContain("      - repomix-matrix");
    expect(workflow).toContain("      - bundle-update-matrix");
    expect(workflow).toContain("      - bun-matrix");
    expect(workflow).toContain("      - reproducibility");
  });

  test("package metadata declares a minimum supported Bun runtime", async () => {
    const pkgRaw = await readText("package.json");
    const pkg = JSON.parse(pkgRaw) as {
      engines?: Record<string, string>;
      packageManager?: string;
    };

    expect(pkg.engines?.bun).toBe(">=1.3.11");
    expect(pkg.packageManager).toBe("bun@1.3.11");
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
