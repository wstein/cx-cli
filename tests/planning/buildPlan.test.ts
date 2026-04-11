import { describe, expect, test } from "bun:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { CxConfig } from "../../src/config/types.js";
import { buildBundlePlan } from "../../src/planning/buildPlan.js";

async function createFixture(): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "cx-plan-"));
  await fs.mkdir(path.join(root, "src"), { recursive: true });
  await fs.mkdir(path.join(root, "docs"), { recursive: true });
  await fs.writeFile(
    path.join(root, "src", "index.ts"),
    "export const value = 1;\n",
    "utf8",
  );
  await fs.writeFile(path.join(root, "docs", "guide.md"), "# Guide\n", "utf8");
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
      exclude: ["dist/**"],
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
      includeOutputSpans: false,
      includeSourceMetadata: true,
    },
    checksums: {
      algorithm: "sha256",
      fileName: "demo.sha256",
    },
    tokens: {
      algorithm: "chars_div_4",
    },
    display: {
      list: {
        bytesWarm: 4096,
        bytesHot: 65536,
        tokensWarm: 512,
        tokensHot: 2048,
        mtimeWarmMinutes: 60,
        mtimeHotHours: 24,
        timePalette: [255, 254, 253, 252, 251, 250, 249, 248, 247, 246],
      },
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
      "src",
    ]);
    expect(plan.sections[0]?.files.map((file) => file.relativePath)).toEqual([
      "docs/guide.md",
    ]);
    expect(plan.assets.map((asset) => asset.relativePath)).toEqual([
      "logo.png",
    ]);
  });

  test("fails on section overlap by default", async () => {
    const root = await createFixture();
    const config = baseConfig(root);
    config.sections.mixed = { include: ["src/**"], exclude: [] };

    await expect(buildBundlePlan(config)).rejects.toThrow(
      "Section overlap detected",
    );
  });
});
