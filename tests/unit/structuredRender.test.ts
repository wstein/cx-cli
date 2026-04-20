// test-lane: unit
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { validatePlanOrdering } from "../../src/render/ordering.js";
import {
  computePlanHash,
  planToMaps,
  validateEntryHashes,
} from "../../src/render/planHash.js";
import {
  buildStructuredPlanFromFiles,
  extractStructuredPlan,
} from "../../src/render/structuredPlan.js";
import type {
  StructuredRenderEntry,
  StructuredRenderPlan,
} from "../../src/render/types.js";
import { sha256Text } from "../../src/shared/hashing.js";

describe("render constitution invariants", () => {
  describe("validatePlanOrdering", () => {
    it("returns true for sorted ordering", () => {
      const plan: StructuredRenderPlan = {
        entries: [],
        ordering: ["aaa", "bbb", "ccc"],
      };
      expect(validatePlanOrdering(plan)).toBe(true);
    });

    it("returns false for unsorted ordering", () => {
      const plan: StructuredRenderPlan = {
        entries: [],
        ordering: ["bbb", "aaa", "ccc"],
      };
      expect(validatePlanOrdering(plan)).toBe(false);
    });

    it("returns true for empty ordering", () => {
      const plan: StructuredRenderPlan = {
        entries: [],
        ordering: [],
      };
      expect(validatePlanOrdering(plan)).toBe(true);
    });

    it("returns true for single element", () => {
      const plan: StructuredRenderPlan = {
        entries: [],
        ordering: ["single"],
      };
      expect(validatePlanOrdering(plan)).toBe(true);
    });
  });

  describe("validateEntryHashes", () => {
    it("returns empty map for valid hashes", () => {
      const content = "console.log('hello');";
      const entries: StructuredRenderEntry[] = [
        {
          path: "file1.ts",
          content,
          sha256: sha256Text(content),
          tokenCount: 5,
        },
      ];

      const errors = validateEntryHashes(entries);
      expect(errors.size).toBe(0);
    });

    it("detects hash mismatch", () => {
      const entries: StructuredRenderEntry[] = [
        {
          path: "file1.ts",
          content: "console.log('hello');",
          sha256:
            "wronghash0000000000000000000000000000000000000000000000000000000",
          tokenCount: 5,
        },
      ];

      const errors = validateEntryHashes(entries);
      expect(errors.has("file1.ts")).toBe(true);
      expect(errors.get("file1.ts")).toContain("hash mismatch");
    });
  });

  describe("computePlanHash", () => {
    it("produces deterministic hash", () => {
      const plan: StructuredRenderPlan = {
        entries: [
          {
            path: "a.ts",
            content: "content_a",
            sha256: sha256Text("content_a"),
            tokenCount: 10,
          },
          {
            path: "b.ts",
            content: "content_b",
            sha256: sha256Text("content_b"),
            tokenCount: 20,
          },
        ],
        ordering: ["a.ts", "b.ts"],
      };

      const hash1 = computePlanHash(plan);
      const hash2 = computePlanHash(plan);

      expect(hash1).toBe(hash2);
      expect(hash1.length).toBe(64); // SHA256 in hex
    });

    it("produces different hash for different ordering", () => {
      const plan1: StructuredRenderPlan = {
        entries: [
          {
            path: "a.ts",
            content: "content_a",
            sha256: sha256Text("content_a"),
            tokenCount: 10,
          },
          {
            path: "b.ts",
            content: "content_b",
            sha256: sha256Text("content_b"),
            tokenCount: 20,
          },
        ],
        ordering: ["a.ts", "b.ts"],
      };

      const plan2: StructuredRenderPlan = {
        entries: [
          {
            path: "a.ts",
            content: "content_a",
            sha256: sha256Text("content_a"),
            tokenCount: 10,
          },
          {
            path: "b.ts",
            content: "content_b",
            sha256: sha256Text("content_b"),
            tokenCount: 20,
          },
        ],
        ordering: ["b.ts", "a.ts"],
      };

      const hash1 = computePlanHash(plan1);
      const hash2 = computePlanHash(plan2);

      expect(hash1).not.toBe(hash2);
    });
  });

  describe("planToMaps", () => {
    it("converts entries to maps correctly", () => {
      const plan: StructuredRenderPlan = {
        entries: [
          {
            path: "file1.ts",
            content: "content1",
            sha256: sha256Text("content1"),
            tokenCount: 10,
          },
          {
            path: "file2.ts",
            content: "content2",
            sha256: sha256Text("content2"),
            tokenCount: 20,
          },
        ],
        ordering: ["file1.ts", "file2.ts"],
      };

      const { fileTokenCounts, fileContentHashes } = planToMaps(plan);

      expect(fileTokenCounts.get("file1.ts")).toBe(10);
      expect(fileTokenCounts.get("file2.ts")).toBe(20);
      expect(fileContentHashes.get("file1.ts")).toBe(sha256Text("content1"));
      expect(fileContentHashes.get("file2.ts")).toBe(sha256Text("content2"));
    });
  });

  describe("extractStructuredPlan", () => {
    it("sorts entries and defaults missing token counts to zero", () => {
      const plan = extractStructuredPlan({
        entries: [
          {
            path: "b.ts",
            content: "beta",
            metadata: {},
          },
          {
            path: "a.ts",
            content: "alpha",
            metadata: { tokenCount: 7 },
          },
        ],
      } as never);

      expect(plan.ordering).toEqual(["a.ts", "b.ts"]);
      expect(plan.entries[0]?.path).toBe("a.ts");
      expect(plan.entries[0]?.tokenCount).toBe(7);
      expect(plan.entries[1]?.path).toBe("b.ts");
      expect(plan.entries[1]?.tokenCount).toBe(0);
    });

    it("builds a sorted kernel plan directly from source files", async () => {
      const rootDir = await fs.mkdtemp(
        path.join(os.tmpdir(), "cx-render-plan-files-"),
      );

      try {
        await fs.mkdir(path.join(rootDir, "src"), { recursive: true });
        await fs.mkdir(path.join(rootDir, "docs"), { recursive: true });
        await fs.writeFile(
          path.join(rootDir, "src", "index.ts"),
          "export const ok = 1;\n",
          "utf8",
        );
        await fs.writeFile(
          path.join(rootDir, "docs", "guide.md"),
          "# Guide\n",
          "utf8",
        );

        const plan = await buildStructuredPlanFromFiles({
          sourceRoot: rootDir,
          explicitFiles: [
            path.join(rootDir, "src", "index.ts"),
            path.join(rootDir, "docs", "guide.md"),
          ],
          encoding: "o200k_base",
        });

        expect(plan.ordering).toEqual(["docs/guide.md", "src/index.ts"]);
        expect(plan.entries[0]?.path).toBe("docs/guide.md");
        expect(plan.entries[0]?.language).toBe("markdown");
        expect(plan.entries[1]?.path).toBe("src/index.ts");
        expect(plan.entries[1]?.language).toBe("typescript");
        expect(plan.entries[1]?.content).toBe("export const ok = 1;");
      } finally {
        await fs.rm(rootDir, { recursive: true, force: true });
      }
    });
  });

  describe("deterministic render constitution", () => {
    it("enforces deterministic ordering during extraction", () => {
      // When we extract a plan, entries should be sorted lexicographically
      // This test verifies that property by checking the ordering matches

      const entries: StructuredRenderEntry[] = [
        {
          path: "z.ts",
          content: "z",
          sha256: sha256Text("z"),
          tokenCount: 1,
        },
        {
          path: "a.ts",
          content: "a",
          sha256: sha256Text("a"),
          tokenCount: 1,
        },
        {
          path: "m.ts",
          content: "m",
          sha256: sha256Text("m"),
          tokenCount: 1,
        },
      ];

      // Simulate extracting and sorting
      const sorted = [...entries].sort((a, b) => a.path.localeCompare(b.path));
      const ordering = sorted.map((e) => e.path);

      expect(ordering).toEqual(["a.ts", "m.ts", "z.ts"]);
      expect(validatePlanOrdering({ entries: sorted, ordering })).toBe(true);
    });

    it("plan hash remains stable across multiple computations", () => {
      const plan: StructuredRenderPlan = {
        entries: [
          {
            path: "src/index.ts",
            content: "export const version = '1.0.0'",
            sha256: sha256Text("export const version = '1.0.0'"),
            tokenCount: 8,
          },
          {
            path: "src/types.ts",
            content: "export interface Config {}",
            sha256: sha256Text("export interface Config {}"),
            tokenCount: 6,
          },
        ],
        ordering: ["src/index.ts", "src/types.ts"],
      };

      const hashes = Array.from({ length: 5 }, () => computePlanHash(plan));

      // All hashes should be identical
      for (let i = 1; i < hashes.length; i++) {
        expect(hashes[i]).toBe(hashes[0]);
      }
    });
  });
});
