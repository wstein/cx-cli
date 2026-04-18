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
    path.join(root, "bin", "cx"),
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
    output: {
      extensions: {
        xml: ".xml.txt",
        json: ".json.txt",
        markdown: ".md",
        plain: ".txt",
      },
    },
    repomix: {
      style: "xml",
      showLineNumbers: false,
      includeEmptyDirectories: false,
      securityCheck: true,
    },
    files: {
      include: [],
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
      assetsLayout: "compiled default",
    },
    mcp: {
      policy: "default",
      auditLogging: true,
    },
    assets: {
      include: ["**/*.png"],
      exclude: [],
      mode: "copy",
      targetDir: "demo-assets",
      layout: "flat",
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
          "bin/cx",
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
      "bin/cx",
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
    expect(plan.assets[0]?.storedPath).toBe("demo-assets/logo.png");
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
          "bin/cx",
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
      "bin/cx",
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

  test("reports multiple overlaps in one aggregated diagnostic", async () => {
    const root = await createFixture();
    const config = baseConfig(root);
    config.sections.docsMirror = { include: ["docs/**"], exclude: [] };
    config.sections.srcMirror = { include: ["src/**"], exclude: [] };

    await expect(buildBundlePlan(config)).rejects.toThrow(
      /Section overlap detected in 2 locations\.[\s\S]*docs\/guide\.md[\s\S]*src\/index\.ts/,
    );
  });

  test("warns instead of failing when dedup.mode=warn", async () => {
    const root = await createFixture();
    const config = baseConfig(root);
    config.dedup.mode = "warn";
    config.sections.mixed = { include: ["src/**"], exclude: [] };

    const plan = await buildBundlePlan(config);

    expect(plan.warnings.length).toBeGreaterThan(0);
    expect(plan.warnings[0]).toContain(
      "Section overlap detected for src/index.ts",
    );
  });

  test("resolves overlaps by priority when dedup.mode=first-wins", async () => {
    const root = await createFixture();
    const config = baseConfig(root);
    config.dedup.mode = "first-wins";
    // sections.src and sections.wide both claim src/**; src has higher priority
    config.sections.wide = { include: ["src/**"], exclude: [], priority: 5 };
    const srcSection = config.sections.src;
    if (!srcSection) {
      throw new Error("Missing src section");
    }
    config.sections.src = {
      ...srcSection,
      include: ["src/**"],
      exclude: [],
      priority: 10,
    };

    const plan = await buildBundlePlan(config);
    const srcFiles = plan.sections
      .find((s) => s.name === "src")
      ?.files.map((f) => f.relativePath);
    const wideFiles = plan.sections
      .find((s) => s.name === "wide")
      ?.files.map((f) => f.relativePath);

    expect(srcFiles).toContain("src/index.ts");
    expect(wideFiles).not.toContain("src/index.ts");
  });

  test("priority ordering is stable: sections without priority preserve base order", async () => {
    const root = await createFixture();
    const config = baseConfig(root);
    config.dedup.mode = "first-wins";
    // Give 'src' a low explicit priority, leave docs and repo without priority (implicit 0)
    const srcSection = config.sections.src;
    if (!srcSection) {
      throw new Error("Missing src section");
    }
    config.sections.src = { ...srcSection, priority: 1 };

    const plan = await buildBundlePlan(config);
    const names = plan.sections.map((s) => s.name);
    // src has priority 1, docs and repo have priority 0 — src sorts first, then
    // docs and repo follow in their config order
    expect(names[0]).toBe("src");
    expect(names.slice(1)).toEqual(["docs", "repo"]);
  });

  test("rejects asset conflicts when a file matches both a section and an asset rule", async () => {
    const root = await createFixture();
    const config = baseConfig(root);
    config.assets.include = ["**/*.png"];
    const repoSection = config.sections.repo;
    if (!repoSection) {
      throw new Error("Missing repo section");
    }
    repoSection.include = [...(repoSection.include ?? []), "**/*.png"];

    await expect(buildBundlePlan(config)).rejects.toThrow(
      /Asset conflict detected for logo\.png: file matches both an asset rule and section repo\./,
    );
  });

  test("rejects asset-only matches when assets.mode=fail", async () => {
    const root = await createFixture();
    const config = baseConfig(root);
    config.assets.mode = "fail";
    config.assets.include = ["**/*.png"];
    config.sections = {
      docs: {
        include: ["docs/**"],
        exclude: [],
      },
      src: {
        include: ["src/**"],
        exclude: [],
      },
    };

    await expect(buildBundlePlan(config)).rejects.toThrow(
      /Asset logo\.png matched an asset rule while assets\.mode=fail\./,
    );
  });

  test("rejects unmatched files after a catch-all exclusion", async () => {
    const root = await createFixture();
    await fs.writeFile(path.join(root, "misc.txt"), "misc\n", "utf8");

    const config = baseConfig(root);
    config.files.unmatched = "fail";
    config.sections = {
      src: {
        include: ["src/**"],
        exclude: [],
      },
      rest: {
        catch_all: true,
        exclude: ["misc.txt"],
      },
    };

    await expect(buildBundlePlan(config)).rejects.toThrow(
      /Unmatched files detected: misc\.txt\./,
    );
  });
});

describe("asset layout", () => {
  test("flat layout places all assets directly in targetDir with no subdirectories", async () => {
    const root = await createFixture();
    await fs.mkdir(path.join(root, "images"), { recursive: true });
    await fs.writeFile(path.join(root, "images", "banner.png"), "fake", "utf8");

    const config = baseConfig(root);
    config.assets.layout = "flat";

    const plan = await buildBundlePlan(config);

    const storedPaths = plan.assets.map((a) => a.storedPath);
    // No path separators inside targetDir — all assets are at the root of the target
    for (const sp of storedPaths) {
      const relative = sp.slice("demo-assets/".length);
      expect(relative).not.toContain("/");
    }
    expect(storedPaths).toContain("demo-assets/logo.png");
    expect(storedPaths).toContain("demo-assets/banner.png");
  });

  test("flat layout appends a numeric postfix to the stem when basenames collide", async () => {
    const root = await createFixture();
    await fs.mkdir(path.join(root, "images"), { recursive: true });
    await fs.mkdir(path.join(root, "icons"), { recursive: true });
    // Two files with the same basename in different directories
    await fs.writeFile(path.join(root, "images", "logo.png"), "img", "utf8");
    await fs.writeFile(path.join(root, "icons", "logo.png"), "icon", "utf8");

    const config = baseConfig(root);
    config.assets.layout = "flat";

    const plan = await buildBundlePlan(config);

    const storedPaths = plan.assets.map((a) => a.storedPath).sort();
    // The root logo.png, icons/logo.png, and images/logo.png all collide.
    // Sorted by relativePath: icons/logo.png, images/logo.png, logo.png
    // → first keeps the original name, subsequent ones get -2, -3, …
    expect(storedPaths).toContain("demo-assets/logo.png");
    expect(storedPaths).toContain("demo-assets/logo-2.png");
    expect(storedPaths).toContain("demo-assets/logo-3.png");
    // All stored paths are distinct
    expect(new Set(storedPaths).size).toBe(storedPaths.length);
  });

  test("deep layout preserves the original relative directory structure under targetDir", async () => {
    const root = await createFixture();
    await fs.mkdir(path.join(root, "images"), { recursive: true });
    await fs.writeFile(path.join(root, "images", "banner.png"), "fake", "utf8");

    const config = baseConfig(root);
    config.assets.layout = "deep";

    const plan = await buildBundlePlan(config);

    const storedPaths = plan.assets.map((a) => a.storedPath).sort();
    expect(storedPaths).toContain("demo-assets/logo.png");
    expect(storedPaths).toContain("demo-assets/images/banner.png");
  });
});
