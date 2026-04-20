// test-lane: integration

import fs from "node:fs/promises";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";

import { loadCxConfig } from "../../src/config/load.js";
import type { CxConfig, CxStyle } from "../../src/config/types.js";
import {
  createRepomixRenderEngine,
  defaultRenderEngine,
} from "../../src/render/engine.js";
import { computeAggregatePlanHash } from "../../src/render/planHash.js";
import { buildConfig } from "../helpers/config/buildConfig.js";
import { createWorkspace } from "../helpers/workspace/createWorkspace.js";
import { createRenderFixture } from "../repomix/helpers.js";

const createdRoots: string[] = [];

afterEach(async () => {
  await Promise.all(
    createdRoots
      .splice(0)
      .map((root) => fs.rm(root, { recursive: true, force: true })),
  );
});

async function compareSectionParity(params: {
  style: CxStyle;
  config: CxConfig;
  sourceRoot: string;
  sectionName: string;
  explicitFiles: string[];
}): Promise<void> {
  const oracleOutputPath = path.join(
    params.sourceRoot,
    `.oracle-${params.style}`,
    "section-output.txt",
  );
  const candidateOutputPath = path.join(
    params.sourceRoot,
    `.candidate-${params.style}`,
    "section-output.txt",
  );
  const oracle = createRepomixRenderEngine();
  const candidate = defaultRenderEngine;

  await fs.mkdir(path.dirname(oracleOutputPath), { recursive: true });
  await fs.mkdir(path.dirname(candidateOutputPath), { recursive: true });

  const [oracleResult, candidateResult] = await Promise.all([
    oracle.renderSection({
      config: params.config,
      style: params.style,
      sourceRoot: params.sourceRoot,
      outputPath: oracleOutputPath,
      sectionName: params.sectionName,
      explicitFiles: params.explicitFiles,
      requireStructured: true,
      requireOutputSpans: params.style !== "json",
    }),
    candidate.renderSection({
      config: params.config,
      style: params.style,
      sourceRoot: params.sourceRoot,
      outputPath: candidateOutputPath,
      sectionName: params.sectionName,
      explicitFiles: params.explicitFiles,
      requireStructured: true,
      requireOutputSpans: params.style !== "json",
    }),
  ]);

  expect(candidateResult.outputText).toBe(oracleResult.outputText);
  expect(candidateResult.planHash).toBe(oracleResult.planHash);
  expect(candidateResult.warnings).toEqual(oracleResult.warnings);
  expect(candidateResult.fileSpans).toEqual(oracleResult.fileSpans);
  expect(candidateResult.structuredPlan).toEqual(oracleResult.structuredPlan);
  expect(Array.from(candidateResult.fileTokenCounts.entries())).toEqual(
    Array.from(oracleResult.fileTokenCounts.entries()),
  );
  expect(Array.from(candidateResult.fileContentHashes.entries())).toEqual(
    Array.from(oracleResult.fileContentHashes.entries()),
  );
}

describe("native render parity", () => {
  test.each([
    "xml",
    "markdown",
    "plain",
    "json",
  ] as const)("matches the adapter oracle for %s section rendering", async (style) => {
    const fixture = await createRenderFixture({
      files: {
        "src/alpha.ts": "export const alpha = 1;\n",
        "src/guide.md": "# Guide\n\n```ts\nconst x = 1;\n```\n",
        "src/zeta.txt": "before </file> after\n",
      },
    });
    createdRoots.push(fixture.rootDir);

    await compareSectionParity({
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
  });

  test("matches the adapter oracle for aggregate plan hashes across sections", async () => {
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

    const oracle = createRepomixRenderEngine();
    const candidate = defaultRenderEngine;

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

    const oraclePlanHashes = new Map<string, string>();
    const candidatePlanHashes = new Map<string, string>();

    for (const section of sectionInputs) {
      await fs.mkdir(path.join(workspace.rootDir, `.oracle-${section.name}`), {
        recursive: true,
      });
      await fs.mkdir(
        path.join(workspace.rootDir, `.candidate-${section.name}`),
        {
          recursive: true,
        },
      );
      const [oracleResult, candidateResult] = await Promise.all([
        oracle.renderSection({
          config,
          style: "xml",
          sourceRoot: workspace.rootDir,
          outputPath: path.join(
            workspace.rootDir,
            `.oracle-${section.name}`,
            "section-output.txt",
          ),
          sectionName: section.name,
          explicitFiles: [...section.explicitFiles],
          requireStructured: true,
          requireOutputSpans: true,
        }),
        candidate.renderSection({
          config,
          style: "xml",
          sourceRoot: workspace.rootDir,
          outputPath: path.join(
            workspace.rootDir,
            `.candidate-${section.name}`,
            "section-output.txt",
          ),
          sectionName: section.name,
          explicitFiles: [...section.explicitFiles],
          requireStructured: true,
          requireOutputSpans: true,
        }),
      ]);

      expect(candidateResult.outputText).toBe(oracleResult.outputText);
      if (!oracleResult.planHash || !candidateResult.planHash) {
        throw new Error(`Missing plan hash for section ${section.name}`);
      }
      oraclePlanHashes.set(section.name, oracleResult.planHash);
      candidatePlanHashes.set(section.name, candidateResult.planHash);
    }

    expect(computeAggregatePlanHash(candidatePlanHashes)).toBe(
      computeAggregatePlanHash(oraclePlanHashes),
    );
  });
});
