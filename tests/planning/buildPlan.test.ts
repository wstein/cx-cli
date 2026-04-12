import { describe, expect, test } from "bun:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { DEFAULT_BEHAVIOR_VALUES } from "../../src/config/defaults.js";
import type { CxConfig } from "../../src/config/types.js";
import { buildBundlePlan } from "../../src/planning/buildPlan.js";

async function createFixture(): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "cx-plan-"));
  await fs.mkdir(path.join(root, "src"), { recursive: true });
  await fs.mkdir(path.join(root, "docs"), { recursive: true });
  await fs.mkdir(path.join(root, "scripts"), { recursive: true });
  await fs.mkdir(path.join(root, "schemas"), { recursive: true });
  await fs.mkdir(path.join(root, "tests", "cli"), { recursive: true });
  await fs.mkdir(path.join(root, "bin"), { recursive: true });
  await fs.mkdir(path.join(root, ".github", "workflows"), {
    recursive: true,
  });
  await fs.writeFile(
    path.join(root, "src", "index.ts"),
    "export const value = 1;\n",
    "utf8",
  );
  await fs.writeFile(path.join(root, "docs", "guide.md"), "# Guide\n", "utf8");
  await fs.writeFile(
    path.join(root, "scripts", "repomix-version-smoke.ts"),
    "export const smoke = true;\n",
    "utf8",
  );
  await fs.writeFile(
    path.join(root, "schemas", "manifest-v5.schema.json"),
    '{"$schema": "https://json-schema.org/draft/2020-12/schema"}\n',
    "utf8",
  );
  await fs.writeFile(path.join(root, "package.json"), "{}\n", "utf8");
  await fs.writeFile(path.join(root, "biome.json"), "{}\n", "utf8");
  await fs.writeFile(
    path.join(root, "cx.toml"),
    'schema_version = 1\nproject_name = "demo"\n',
    "utf8",
  );
  await fs.writeFile(
    path.join(root, "tests", "cli", "main.test.ts"),
    "test('demo', () => {});\n",
    "utf8",
  );
  await fs.writeFile(path.join(root, "tsconfig.json"), "{}\n", "utf8");
  await fs.writeFile(path.join(root, "tsconfig.test.json"), "{}\n", "utf8");
  await fs.writeFile(
    path.join(root, "bin", "cx.js"),
    "#!/usr/bin/env node\n",
    "utf8",
  );
  await fs.writeFile(
    path.join(root, ".github", "workflows", "ci.yml"),
    "name: CI\n",
    "utf8",
  );
  await fs.writeFile(path.join(root, "bun.lock"), "locked\n", "utf8");
  await fs.writeFile(path.join(root, "logo.png"), "fake", "utf8");
  return root;
}

function baseConfig(root: string): CxConfig {
  return {
    schemaVersion: 1,
    projectName: "demo",
    sourceRoot: root,
    outputDir: path.join(root, "dist", "demo-bundle"),
    repomix: {
      style: "xml",
      showLineNumbers: false,
      includeEmptyDirectories: false,
      securityCheck: true,
    },
    files: {
      exclude: ["dist/**", "bun.lock"],
      followSymlinks: false,
      unmatched: "ignore",
    },
    dedup: {
      mode: "fail",
      order: "config",
    },
    manifest: {
      format: "json",
      pretty: true,
      includeFileSha256: true,
      includeOutputSha256: true,
      includeOutputSpans: true,
      includeSourceMetadata: true,
    },
    checksums: {
      algorithm: "sha256",
      fileName: "demo.sha256",
    },
    tokens: {
      encoding: "o200k_base",
    },
    behavior: {
      ...DEFAULT_BEHAVIOR_VALUES,
    },
    behaviorSources: {
      dedupMode: "compiled default",
      repomixMissingExtension: "compiled default",
      configDuplicateEntry: "compiled default",
    },
    assets: {
      include: ["**/*.png"],
      exclude: [],
      mode: "copy",
      targetDir: "demo-assets",
    },
    sections: {
      docs: {
        include: ["docs/**"],
        exclude: [],
      },
      repo: {
        include: [
          ".github/workflows/ci.yml",
          ".gitignore",
          "biome.json",
          "bin/cx.js",
          "cx.toml",
          "package.json",
          "schemas/**",
          "scripts/**",
          "tsconfig.json",
          "tsconfig.test.json",
        ],
        exclude: [],
      },
      src: {
        include: ["src/**"],
        exclude: [],
      },
    },
  };
}

describe("buildBundlePlan", () => {
  test("creates a deterministic plan with text files and assets", async () => {
    const root = await createFixture();
    const plan = await buildBundlePlan(baseConfig(root));

    expect(plan.sections.map((section) => section.name)).toEqual([
      "docs",
      "repo",
      "src",
    ]);
    expect(plan.sections[0]?.files.map((file) => file.relativePath)).toEqual([
      "docs/guide.md",
    ]);
    expect(
      plan.sections
        .find((section) => section.name === "repo")
        ?.files.map((file) => file.relativePath),
    ).toEqual([
      ".github/workflows/ci.yml",
      "bin/cx.js",
      "biome.json",
      "cx.toml",
      "package.json",
      "schemas/manifest-v5.schema.json",
      "scripts/repomix-version-smoke.ts",
      "tsconfig.json",
      "tsconfig.test.json",
    ]);
    expect(plan.assets.map((asset) => asset.relativePath)).toEqual([
      "logo.png",
    ]);
  });

  test("keeps scripts and schemas inside the repo section", async () => {
    const root = await createFixture();
    const config = baseConfig(root);
    config.sections = {
      docs: {
        include: ["README.md", "docs/**"],
        exclude: [],
      },
      repo: {
        include: [
          ".github/workflows/ci.yml",
          ".gitignore",
          "biome.json",
          "bin/cx.js",
          "cx.toml",
          "package.json",
          "schemas/**",
          "scripts/**",
          "tsconfig.json",
          "tsconfig.test.json",
        ],
        exclude: [],
      },
      src: {
        include: ["src/**"],
        exclude: [],
      },
      tests: {
        include: ["tests/**"],
        exclude: [],
      },
    };

    const plan = await buildBundlePlan(config);

    expect(plan.sections.map((section) => section.name)).toEqual([
      "docs",
      "repo",
      "src",
      "tests",
    ]);
    expect(
      plan.sections
        .find((section) => section.name === "repo")
        ?.files.map((file) => file.relativePath),
    ).toEqual([
      ".github/workflows/ci.yml",
      "bin/cx.js",
      "biome.json",
      "cx.toml",
      "package.json",
      "schemas/manifest-v5.schema.json",
      "scripts/repomix-version-smoke.ts",
      "tsconfig.json",
      "tsconfig.test.json",
    ]);
    expect(
      plan.sections
        .find((section) => section.name === "tests")
        ?.files.map((file) => file.relativePath),
    ).toEqual(["tests/cli/main.test.ts"]);
    expect(plan.unmatchedFiles).not.toContain("bun.lock");
  });

  test("fails on section overlap by default", async () => {
    const root = await createFixture();
    const config = baseConfig(root);
    config.sections.mixed = { include: ["src/**"], exclude: [] };

    await expect(buildBundlePlan(config)).rejects.toThrow(
      /Section overlap detected for src\/index\.ts\.[\s\S]*Matching sections: src, mixed\.[\s\S]*Recommended owner: src\.[\s\S]*Suggested exclude rules:/,
    );
  });
});
