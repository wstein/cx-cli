// test-lane: contract

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);

async function readPackageScripts(): Promise<Record<string, string>> {
  const raw = await fs.readFile(path.join(ROOT, "package.json"), "utf8");
  const parsed = JSON.parse(raw) as {
    scripts?: Record<string, string>;
  };
  return parsed.scripts ?? {};
}

describe("assurance ladder contract", () => {
  test("certify includes CI-equivalent assurance lanes", async () => {
    const scripts = await readPackageScripts();
    const certify = scripts.certify ?? "";

    expect(certify).toContain("bun run verify");
    expect(certify).toContain("bun run ci:test:coverage");
    expect(certify).toContain("bun run ci:test:contracts");
    expect(certify).toContain("bun run ci:smoke:repomix-version");
    expect(certify).toContain("bun run ci:smoke:bundle-transition");
    expect(certify).toContain("bun run ci:assurance:release-integrity");
    expect(certify).toContain("bun run ci:assurance:reproducibility");
  });

  test("assurance lane scripts are defined", async () => {
    const scripts = await readPackageScripts();

    expect(typeof scripts.verify).toBe("string");
    expect(typeof scripts["ci:test:coverage"]).toBe("string");
    expect(typeof scripts["test:contracts"]).toBe("string");
    expect(typeof scripts["smoke:repomix-version"]).toBe("string");
    expect(typeof scripts["smoke:bundle-transition"]).toBe("string");
    expect(typeof scripts["smoke:release-integrity"]).toBe("string");
    expect(typeof scripts.integrity).toBe("string");
    expect(typeof scripts["verify-release"]).toBe("string");
  });

  test("verify stays on the lighter Vitest-plus-compat gate while test is the fast lane", async () => {
    const scripts = await readPackageScripts();

    expect(scripts.verify).toContain("bun run ci:test:coverage");
    expect(scripts.verify).toContain("bun run ci:test:compat");
    expect(scripts.verify).not.toContain("bun run test:all:full");
    expect(scripts.test).toBe("bun run test:unit");

    // neither operator-facing script may use the old directory-style invocation
    expect(scripts.verify).not.toMatch(/bun test\s+--coverage\s+tests/);
    expect(scripts.test).not.toMatch(/bun test\s+--coverage\s+tests/);
  });
});
