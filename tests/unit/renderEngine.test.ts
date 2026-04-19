// test-lane: unit

import { describe, expect, test, vi } from "vitest";

import {
  AdapterBackedRenderEngine,
  defaultRenderEngine,
} from "../../src/render/engine.js";
import { computeAggregatePlanHash } from "../../src/render/planHash.js";
import type { RenderSectionResult } from "../../src/render/types.js";
import { buildConfig } from "../helpers/config/buildConfig.js";

describe("kernel render engine", () => {
  test("adapter-backed engine delegates renderSection calls", async () => {
    const result: RenderSectionResult = {
      outputText: "<xml />\n",
      outputTokenCount: 7,
      fileTokenCounts: new Map([["src/index.ts", 7]]),
      fileContentHashes: new Map([["src/index.ts", "a".repeat(64)]]),
      warnings: [],
    };
    const renderSection = vi.fn().mockResolvedValue(result);
    const engine = new AdapterBackedRenderEngine(renderSection);
    const config = buildConfig({
      sourceRoot: "/repo",
      projectName: "demo",
      sections: {
        src: {
          include: ["src/**"],
          exclude: [],
        },
      },
    });

    await expect(
      engine.renderSection({
        config,
        style: "xml",
        sourceRoot: "/repo",
        outputPath: "/tmp/out",
        sectionName: "src",
        explicitFiles: ["/repo/src/index.ts"],
      }),
    ).resolves.toBe(result);

    expect(renderSection).toHaveBeenCalledTimes(1);
    expect(defaultRenderEngine).toBeDefined();
  });
});

describe("aggregate render plan hashing", () => {
  test("returns undefined when no section plan hashes are present", () => {
    expect(computeAggregatePlanHash(new Map())).toBeUndefined();
  });

  test("is deterministic regardless of insertion order", () => {
    const left = new Map<string, string>([
      ["docs", "a".repeat(64)],
      ["src", "b".repeat(64)],
    ]);
    const right = new Map<string, string>([
      ["src", "b".repeat(64)],
      ["docs", "a".repeat(64)],
    ]);

    expect(computeAggregatePlanHash(left)).toBe(
      computeAggregatePlanHash(right),
    );
  });
});
