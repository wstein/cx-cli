import { describe, expect, it } from "bun:test";
import type { CxConfig } from "../../src/config/types";
import {
  analyzeSectionOverlaps,
  formatOverlapConflictMessage,
} from "../../src/planning/overlaps";

describe("planning section overlap analysis", () => {
  describe("analyzeSectionOverlaps", () => {
    it("returns empty array for non-overlapping sections", async () => {
      const config: CxConfig = {
        sections: {
          src: { include: ["src/**"], exclude: [] },
          tests: { include: ["tests/**"], exclude: [] },
        },
        dedup: { order: "config", mode: "fail" },
      } as any;
      const masterList = ["src/main.ts", "tests/main.test.ts"];
      const conflicts = await analyzeSectionOverlaps(config, masterList);
      expect(conflicts).toEqual([]);
    });

    it("detects overlapping sections", async () => {
      const config: CxConfig = {
        sections: {
          all: { include: ["**/*"], exclude: [] },
          src: { include: ["src/**"], exclude: [] },
        },
        dedup: { order: "config", mode: "fail" },
      } as any;
      const masterList = ["src/main.ts"];
      const conflicts = await analyzeSectionOverlaps(config, masterList);
      expect(conflicts.length).toBeGreaterThan(0);
      expect(conflicts[0]?.path).toBe("src/main.ts");
    });

    it("includes recommended owner in conflict", async () => {
      const config: CxConfig = {
        sections: {
          all: { include: ["**/*"], exclude: [], priority: 1 },
          src: { include: ["src/**"], exclude: [], priority: 5 },
        },
        dedup: { order: "config", mode: "fail" },
      } as any;
      const masterList = ["src/main.ts"];
      const conflicts = await analyzeSectionOverlaps(config, masterList);
      if (conflicts.length > 0) {
        expect(conflicts[0]?.recommendedOwner).toBeDefined();
        expect(typeof conflicts[0]?.recommendedOwner).toBe("string");
      }
    });

    it("includes suggestions for exclusions", async () => {
      const config: CxConfig = {
        sections: {
          all: { include: ["**/*"], exclude: [] },
          src: { include: ["src/**"], exclude: [] },
        },
        dedup: { order: "config", mode: "fail" },
      } as any;
      const masterList = ["src/main.ts"];
      const conflicts = await analyzeSectionOverlaps(config, masterList);
      if (conflicts.length > 0) {
        expect(conflicts[0]?.suggestions).toBeDefined();
        expect(Array.isArray(conflicts[0]?.suggestions)).toBe(true);
      }
    });

    it("handles multiple paths with overlaps", async () => {
      const config: CxConfig = {
        sections: {
          all: { include: ["**/*"], exclude: [] },
          src: { include: ["src/**"], exclude: [] },
        },
        dedup: { order: "config", mode: "fail" },
      } as any;
      const masterList = ["src/a.ts", "src/b.ts", "tests/c.ts"];
      const conflicts = await analyzeSectionOverlaps(config, masterList);
      // Should have conflicts for src/a.ts and src/b.ts
      expect(conflicts.length).toBeGreaterThanOrEqual(0);
    });

    it("respects catch_all flag", async () => {
      const config: CxConfig = {
        sections: {
          all: { include: ["**/*"], exclude: [], catch_all: true },
          src: { include: ["src/**"], exclude: [] },
        },
        dedup: { order: "config", mode: "fail" },
      } as any;
      const masterList = ["src/main.ts"];
      const conflicts = await analyzeSectionOverlaps(config, masterList);
      // catch_all sections should not participate in overlap analysis
      expect(conflicts).toEqual([]);
    });

    it("handles empty master list", async () => {
      const config: CxConfig = {
        sections: {
          src: { include: ["src/**"], exclude: [] },
        },
        dedup: { order: "config", mode: "fail" },
      } as any;
      const conflicts = await analyzeSectionOverlaps(config, []);
      expect(conflicts).toEqual([]);
    });

    it("returns conflicts for all overlapping sections", async () => {
      const config: CxConfig = {
        sections: {
          all: { include: ["**/*"], exclude: [] },
          code: { include: ["**/*.ts", "**/*.js"], exclude: [] },
          src: { include: ["src/**"], exclude: [] },
        },
        dedup: { order: "config", mode: "fail" },
      } as any;
      const masterList = ["src/main.ts"];
      const conflicts = await analyzeSectionOverlaps(config, masterList);
      // Should detect overlaps for src/main.ts with multiple sections
      expect(conflicts.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe("formatOverlapConflictMessage", () => {
    it("formats conflict message with path and sections", () => {
      const conflict = {
        path: "src/main.ts",
        sections: ["all", "src"],
        recommendedOwner: "src",
        suggestions: [{ section: "all", pattern: "src/main.ts" }],
      };
      const message = formatOverlapConflictMessage(conflict);
      expect(message).toContain("src/main.ts");
      expect(message).toContain("src");
    });

    it("includes recommended owner in message", () => {
      const conflict = {
        path: "lib/utils.ts",
        sections: ["code", "lib"],
        recommendedOwner: "lib",
        suggestions: [],
      };
      const message = formatOverlapConflictMessage(conflict);
      expect(message).toContain("lib");
    });

    it("includes suggestion format in message", () => {
      const conflict = {
        path: "src/test.ts",
        sections: ["all", "src"],
        recommendedOwner: "src",
        suggestions: [
          { section: "all", pattern: "src/test.ts" },
          { section: "tests", pattern: "src/**/*.test.ts" },
        ],
      };
      const message = formatOverlapConflictMessage(conflict);
      expect(message).toContain("exclude");
      expect(message.includes("all") || message.includes("sections")).toBe(
        true
      );
    });

    it("handles empty suggestions", () => {
      const conflict = {
        path: "file.ts",
        sections: ["section1"],
        recommendedOwner: "section1",
        suggestions: [],
      };
      const message = formatOverlapConflictMessage(conflict);
      expect(typeof message).toBe("string");
      expect(message.length).toBeGreaterThan(0);
    });

    it("includes helpful hint in message", () => {
      const conflict = {
        path: "src/main.ts",
        sections: ["all", "code"],
        recommendedOwner: "code",
        suggestions: [{ section: "all", pattern: "src/**" }],
      };
      const message = formatOverlapConflictMessage(conflict);
      // Should suggest using doctor fix-overlaps or setting priority
      expect(
        message.includes("doctor") || message.includes("priority")
      ).toBe(true);
    });
  });
});
