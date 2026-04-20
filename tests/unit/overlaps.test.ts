// test-lane: unit
import { describe, expect, it } from "vitest";
import type { CxConfig, CxSectionConfig } from "../../src/config/types.js";
import {
  compileMatchers,
  getMatchingSections,
  getSectionEntries,
  getSectionOrder,
  matchesAny,
} from "../../src/planning/overlaps.js";

describe("planning overlaps", () => {
  function firstMatcher(
    matchers: Array<(value: string) => boolean>,
  ): (value: string) => boolean {
    const matcher = matchers[0];
    if (!matcher) {
      throw new Error("expected at least one matcher");
    }
    return matcher;
  }

  describe("compileMatchers", () => {
    it("compiles glob patterns into matcher functions", () => {
      const patterns = ["**/*.ts"];
      const matchers = compileMatchers(patterns);
      expect(matchers).toHaveLength(1);
      expect(typeof matchers[0]).toBe("function");
    });

    it("returns array of matchers for multiple patterns", () => {
      const patterns = ["**/*.ts", "**/*.js", "**/*.jsx"];
      const matchers = compileMatchers(patterns);
      expect(matchers).toHaveLength(3);
    });

    it("returns empty array for empty patterns", () => {
      const patterns: string[] = [];
      const matchers = compileMatchers(patterns);
      expect(matchers).toHaveLength(0);
    });

    it("compiled matchers work with basic file patterns", () => {
      const patterns = ["**/*.ts"];
      const matchers = compileMatchers(patterns);
      expect(matchesAny(matchers, "file.ts")).toBe(true);
      expect(matchesAny(matchers, "file.js")).toBe(false);
    });
  });

  describe("matchesAny", () => {
    const tsMatcher = firstMatcher(compileMatchers(["**/*.ts"]));
    const jsMatcher = firstMatcher(compileMatchers(["**/*.js"]));

    it("returns true when any matcher matches", () => {
      const matchers = [tsMatcher, jsMatcher];
      expect(matchesAny(matchers, "file.ts")).toBe(true);
      expect(matchesAny(matchers, "file.js")).toBe(true);
    });

    it("returns false when no matchers match", () => {
      const matchers = [tsMatcher, jsMatcher];
      expect(matchesAny(matchers, "file.css")).toBe(false);
    });

    it("returns false for empty matchers array", () => {
      const matchers: Array<(value: string) => boolean> = [];
      expect(matchesAny(matchers, "file.ts")).toBe(false);
    });

    it("handles single matcher", () => {
      const matchers = [tsMatcher];
      expect(matchesAny(matchers, "file.ts")).toBe(true);
      expect(matchesAny(matchers, "file.js")).toBe(false);
    });

    it("returns true for first match", () => {
      const matchers = [tsMatcher, jsMatcher];
      expect(matchesAny(matchers, "file.ts")).toBe(true);
    });

    it("handles complex glob patterns", () => {
      const matchers = compileMatchers(["src/**/*.ts", "tests/**/*.ts"]);
      expect(matchesAny(matchers, "src/main.ts")).toBe(true);
      expect(matchesAny(matchers, "tests/main.test.ts")).toBe(true);
      expect(matchesAny(matchers, "docs/main.ts")).toBe(false);
    });
  });

  describe("getSectionOrder", () => {
    it("returns section names from config in config order", () => {
      const config: CxConfig = {
        sections: {
          core: { include: ["src/**"], exclude: [] },
          tests: { include: ["tests/**"], exclude: [] },
        },
        dedup: {
          order: "config",
          mode: "fail",
          requireExplicitOwnership: false,
        },
      } as unknown as CxConfig;
      const order = getSectionOrder(config);
      expect(order).toEqual(["core", "tests"]);
    });

    it("sorts lexically when dedup.order is lexical", () => {
      const config: CxConfig = {
        sections: {
          zebra: { include: [], exclude: [] },
          apple: { include: [], exclude: [] },
          middle: { include: [], exclude: [] },
        },
        dedup: {
          order: "lexical",
          mode: "fail",
          requireExplicitOwnership: false,
        },
      } as unknown as CxConfig;
      const order = getSectionOrder(config);
      expect(order).toEqual(["apple", "middle", "zebra"]);
    });

    it("respects section priority when set", () => {
      const config: CxConfig = {
        sections: {
          low: { include: [], exclude: [], priority: 1 },
          high: { include: [], exclude: [], priority: 10 },
          medium: { include: [], exclude: [], priority: 5 },
        },
        dedup: {
          order: "config",
          mode: "fail",
          requireExplicitOwnership: false,
        },
      } as unknown as CxConfig;
      const order = getSectionOrder(config);
      expect(order[0]).toBe("high");
      expect(order[1]).toBe("medium");
      expect(order[2]).toBe("low");
    });

    it("handles sections with undefined priority", () => {
      const config: CxConfig = {
        sections: {
          noprio: { include: [], exclude: [] },
          high: { include: [], exclude: [], priority: 5 },
        },
        dedup: {
          order: "config",
          mode: "fail",
          requireExplicitOwnership: false,
        },
      } as unknown as CxConfig;
      const order = getSectionOrder(config);
      expect(order[0]).toBe("high");
    });

    it("preserves config order for equal priorities", () => {
      const config: CxConfig = {
        sections: {
          first: { include: [], exclude: [], priority: 5 },
          second: { include: [], exclude: [], priority: 5 },
          third: { include: [], exclude: [], priority: 5 },
        },
        dedup: {
          order: "config",
          mode: "fail",
          requireExplicitOwnership: false,
        },
      } as unknown as CxConfig;
      const order = getSectionOrder(config);
      expect(order).toEqual(["first", "second", "third"]);
    });

    it("returns empty array for config with no sections", () => {
      const config: CxConfig = {
        sections: {},
        dedup: {
          order: "config",
          mode: "fail",
          requireExplicitOwnership: false,
        },
      } as unknown as CxConfig;
      const order = getSectionOrder(config);
      expect(order).toEqual([]);
    });

    it("handles single section", () => {
      const config: CxConfig = {
        sections: {
          only: { include: ["**/*"], exclude: [] },
        },
        dedup: {
          order: "config",
          mode: "fail",
          requireExplicitOwnership: false,
        },
      } as unknown as CxConfig;
      const order = getSectionOrder(config);
      expect(order).toEqual(["only"]);
    });
  });

  describe("getSectionEntries", () => {
    it("returns map of section names to configs", () => {
      const config: CxConfig = {
        sections: {
          core: { include: ["src/**"], exclude: [] },
          tests: { include: ["tests/**"], exclude: [] },
        },
        dedup: {
          order: "config",
          mode: "fail",
          requireExplicitOwnership: false,
        },
      } as unknown as CxConfig;
      const entries = getSectionEntries(config);
      expect(entries.size).toBe(2);
      expect(entries.has("core")).toBe(true);
      expect(entries.has("tests")).toBe(true);
    });

    it("preserves section order from getSectionOrder", () => {
      const config: CxConfig = {
        sections: {
          zebra: { include: [], exclude: [], priority: 1 },
          apple: { include: [], exclude: [], priority: 5 },
        },
        dedup: {
          order: "lexical",
          mode: "fail",
          requireExplicitOwnership: false,
        },
      } as unknown as CxConfig;
      const entries = getSectionEntries(config);
      const keys = [...entries.keys()];
      expect(keys[0]).toBe("apple");
      expect(keys[1]).toBe("zebra");
    });

    it("returns empty map for config with no sections", () => {
      const config: CxConfig = {
        sections: {},
        dedup: {
          order: "config",
          mode: "fail",
          requireExplicitOwnership: false,
        },
      } as unknown as CxConfig;
      const entries = getSectionEntries(config);
      expect(entries.size).toBe(0);
    });

    it("includes section configuration in map values", () => {
      const config: CxConfig = {
        sections: {
          src: {
            include: ["src/**"],
            exclude: ["src/test/**"],
            priority: 5,
          },
        },
        dedup: {
          order: "config",
          mode: "fail",
          requireExplicitOwnership: false,
        },
      } as unknown as CxConfig;
      const entries = getSectionEntries(config);
      const srcSection = entries.get("src");
      expect(srcSection).toEqual({
        include: ["src/**"],
        exclude: ["src/test/**"],
        priority: 5,
      });
    });
  });

  describe("getMatchingSections", () => {
    it("returns sections that match file path", () => {
      const sections = new Map([
        ["src", { include: ["src/**"], exclude: [] } as CxSectionConfig],
        ["tests", { include: ["tests/**"], exclude: [] } as CxSectionConfig],
      ]);
      const result = getMatchingSections("src/main.ts", sections);
      expect(result).toContain("src");
      expect(result).not.toContain("tests");
    });

    it("returns empty array when no sections match", () => {
      const sections = new Map([
        ["src", { include: ["src/**"], exclude: [] } as CxSectionConfig],
      ]);
      const result = getMatchingSections("docs/readme.md", sections);
      expect(result).toEqual([]);
    });

    it("returns multiple sections if path matches multiple", () => {
      const sections = new Map([
        ["all", { include: ["**/*"], exclude: [] } as CxSectionConfig],
        ["src", { include: ["src/**"], exclude: [] } as CxSectionConfig],
      ]);
      const result = getMatchingSections("src/main.ts", sections);
      expect(result).toContain("all");
      expect(result).toContain("src");
    });

    it("respects exclude patterns", () => {
      const sections = new Map([
        [
          "src",
          {
            include: ["src/**"],
            exclude: ["src/test/**"],
          } as CxSectionConfig,
        ],
      ]);
      const result1 = getMatchingSections("src/main.ts", sections);
      const result2 = getMatchingSections("src/test/main.test.ts", sections);
      expect(result1).toContain("src");
      expect(result2).not.toContain("src");
    });

    it("doesn't match sections without include patterns", () => {
      const sections = new Map([
        ["empty", { include: [], exclude: [] } as CxSectionConfig],
      ]);
      const result = getMatchingSections("any/file.ts", sections);
      expect(result).toEqual([]);
    });

    it("handles complex glob patterns", () => {
      const sections = new Map([
        [
          "code",
          {
            include: ["src/**/*.{ts,js}", "lib/**/*.ts"],
            exclude: [],
          } as CxSectionConfig,
        ],
      ]);
      const result1 = getMatchingSections("src/main.ts", sections);
      const result2 = getMatchingSections("lib/utils.ts", sections);
      const result3 = getMatchingSections("docs/readme.md", sections);
      expect(result1).toContain("code");
      expect(result2).toContain("code");
      expect(result3).not.toContain("code");
    });

    it("preserves section order from input map", () => {
      const sections = new Map([
        ["z", { include: ["**/*"], exclude: [] } as CxSectionConfig],
        ["a", { include: ["**/*"], exclude: [] } as CxSectionConfig],
      ]);
      const result = getMatchingSections("file.txt", sections);
      // Order should be preserved from the Map insertion order
      expect(result[0]).toBe("z");
      expect(result[1]).toBe("a");
    });

    it("handles paths with special characters", () => {
      const sections = new Map([
        ["src", { include: ["src/**"], exclude: [] } as CxSectionConfig],
      ]);
      const result = getMatchingSections("src/my-file_v1.test.ts", sections);
      expect(result).toContain("src");
    });

    it("returns empty array for empty sections map", () => {
      const sections = new Map();
      const result = getMatchingSections("any/file.ts", sections);
      expect(result).toEqual([]);
    });

    it("handles nested exclude patterns", () => {
      const sections = new Map([
        [
          "src",
          {
            include: ["src/**"],
            exclude: ["src/**/test/**", "src/**/*.spec.ts"],
          } as CxSectionConfig,
        ],
      ]);
      const result1 = getMatchingSections("src/lib/code.ts", sections);
      const result2 = getMatchingSections("src/lib/test/code.ts", sections);
      const result3 = getMatchingSections("src/lib/code.spec.ts", sections);
      expect(result1).toContain("src");
      expect(result2).not.toContain("src");
      expect(result3).not.toContain("src");
    });
  });
});
