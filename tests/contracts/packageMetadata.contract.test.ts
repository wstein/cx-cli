// test-lane: contract

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);

async function readPackageJson(): Promise<{
  description?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}> {
  return JSON.parse(
    await fs.readFile(path.join(ROOT, "package.json"), "utf8"),
  ) as {
    description?: string;
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };
}

describe("package metadata contract", () => {
  test("package description stays repository-native and not Repomix-first", async () => {
    const pkg = await readPackageJson();

    expect(pkg.description).toBe(
      "Repository-native toolchain for MCP workspaces and AI handoffs",
    );
    expect(pkg.description).not.toContain("built on top of Repomix");
  });

  test("runtime package metadata does not ship the historical fork dependency", async () => {
    const pkg = await readPackageJson();

    expect(pkg.dependencies?.["@wsmy/repomix-cx-fork"]).toBeUndefined();
  });

  test("official repomix remains a non-runtime reference dependency", async () => {
    const pkg = await readPackageJson();

    expect(pkg.devDependencies?.repomix).toBeDefined();
    expect(pkg.dependencies?.repomix).toBeUndefined();
  });
});
