// test-lane: integration

import fs from "node:fs/promises";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";

import { loadCxConfig } from "../../src/config/load.js";
import type { CxConfig, CxStyle } from "../../src/config/types.js";
import { defaultRenderEngine } from "../../src/render/engine.js";
import { computeAggregatePlanHash } from "../../src/render/planHash.js";
import { buildConfig } from "../helpers/config/buildConfig.js";
import { createWorkspace } from "../helpers/workspace/createWorkspace.js";
import { createRenderFixture } from "../oracle/helpers.js";

const createdRoots: string[] = [];

afterEach(async () => {
  await Promise.all(
    createdRoots
      .splice(0)
      .map((root) => fs.rm(root, { recursive: true, force: true })),
  );
});

function serializeRenderResult(
  result: Awaited<ReturnType<typeof defaultRenderEngine.renderSection>>,
) {
  return {
    outputText: result.outputText,
    planHash: result.planHash ?? null,
    warnings: result.warnings,
    fileSpans: Object.fromEntries(
      [...(result.fileSpans ?? new Map()).entries()].map(([filePath, span]) => [
        filePath,
        span,
      ]),
    ),
    structuredPlan: result.structuredPlan ?? null,
    fileTokenCounts: Object.fromEntries(result.fileTokenCounts),
    fileContentHashes: Object.fromEntries(result.fileContentHashes),
  };
}

async function renderSectionFixture(params: {
  style: CxStyle;
  config: CxConfig;
  sourceRoot: string;
  sectionName: string;
  explicitFiles: string[];
}) {
  const outputPath = path.join(
    params.sourceRoot,
    `.contract-${params.style}`,
    "section-output.txt",
  );

  await fs.mkdir(path.dirname(outputPath), { recursive: true });

  return defaultRenderEngine.renderSection({
    config: params.config,
    style: params.style,
    sourceRoot: params.sourceRoot,
    outputPath,
    sectionName: params.sectionName,
    explicitFiles: params.explicitFiles,
    requireStructured: true,
    requireOutputSpans: params.style !== "json",
  });
}

describe("native render parity", () => {
  test.each([
    "xml",
    "markdown",
    "plain",
    "json",
  ] as const)("matches the frozen render contract for %s section rendering", async (style) => {
    const fixture = await createRenderFixture({
      files: {
        "src/alpha.ts": "export const alpha = 1;\n",
        "src/guide.md": "# Guide\n\n```ts\nconst x = 1;\n```\n",
        "src/zeta.txt": "before </file> after\n",
      },
    });
    createdRoots.push(fixture.rootDir);

    const result = await renderSectionFixture({
      style,
      config: fixture.config,
      sourceRoot: fixture.rootDir,
      sectionName: "src",
      explicitFiles: [
        path.join(fixture.rootDir, "src", "alpha.ts"),
        path.join(fixture.rootDir, "src", "guide.md"),
        path.join(fixture.rootDir, "src", "index.ts"),
        path.join(fixture.rootDir, "src", "zeta.txt"),
      ],
    });

    expect(serializeRenderResult(result)).toMatchSnapshot();
  });

  test("matches the frozen render contract for aggregate plan hashes across sections", async () => {
    const workspace = await createWorkspace({
      config: buildConfig({
        manifest: { includeOutputSpans: true },
        sections: {
          docs: { include: ["docs/**", "README.md"], exclude: [] },
          src: { include: ["src/**"], exclude: [] },
        },
      }),
      files: {
        "README.md": "# Demo\n\nshared\n",
        "docs/guide.md": "hello\n================\nstill content\n",
        "src/index.ts": "export const demo = true;\n",
        "src/util.ts": "export function util() {\n  return 1;\n}\n",
      },
    });
    createdRoots.push(workspace.rootDir);
    const config = await loadCxConfig(
      workspace.configPath,
      undefined,
      undefined,
      {
        emitBehaviorLogs: false,
      },
    );

    const sectionInputs = [
      {
        name: "docs",
        explicitFiles: [
          path.join(workspace.rootDir, "README.md"),
          path.join(workspace.rootDir, "docs", "guide.md"),
        ],
      },
      {
        name: "src",
        explicitFiles: [
          path.join(workspace.rootDir, "src", "index.ts"),
          path.join(workspace.rootDir, "src", "util.ts"),
        ],
      },
    ] as const;

    const sectionPlanHashes = new Map<string, string>();

    for (const section of sectionInputs) {
      const result = await renderSectionFixture({
        style: "xml",
        config,
        sourceRoot: workspace.rootDir,
        sectionName: section.name,
        explicitFiles: [...section.explicitFiles],
      });

      if (!result.planHash) {
        throw new Error(`Missing plan hash for section ${section.name}`);
      }

      sectionPlanHashes.set(section.name, result.planHash);
    }

    expect({
      sectionPlanHashes: Object.fromEntries(sectionPlanHashes),
      aggregatePlanHash: computeAggregatePlanHash(sectionPlanHashes),
    }).toMatchSnapshot();
  });
});
