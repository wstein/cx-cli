import { describe, expect, test } from "bun:test";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

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
    expect(certify).toContain("bun run test:contracts");
    expect(certify).toContain("bun run smoke:repomix-version");
    expect(certify).toContain("bun run smoke:bundle-transition");
    expect(certify).toContain("bun run smoke:release-integrity");
    expect(certify).toContain("node scripts/reproducibility-check.js");
  });

  test("assurance lane scripts are defined", async () => {
    const scripts = await readPackageScripts();

    expect(typeof scripts.verify).toBe("string");
    expect(typeof scripts["test:contracts"]).toBe("string");
    expect(typeof scripts["smoke:repomix-version"]).toBe("string");
    expect(typeof scripts["smoke:bundle-transition"]).toBe("string");
    expect(typeof scripts["smoke:release-integrity"]).toBe("string");
    expect(typeof scripts.integrity).toBe("string");
    expect(typeof scripts["verify-release"]).toBe("string");
  });
});
