import { describe, expect, it } from "bun:test";
import { mergeConfigs, validateMergeConfig } from "../../src/config/merge.js";

describe("Config Merge Safety", () => {
  describe("mergeConfigs", () => {
    it("overwrites scalar values", () => {
      const base: Record<string, unknown> = { name: "base", value: 1 };
      const override: Record<string, unknown> = { value: 2 };

      const result = mergeConfigs(base, override);

      expect((result.value as Record<string, unknown>).name).toBe("base");
      expect((result.value as Record<string, unknown>).value).toBe(2);
      expect(result.conflicts.length).toBe(1);
      expect(result.conflicts[0]?.reason).toContain("scalar");
    });

    it("appends to arrays", () => {
      const base: Record<string, unknown> = { items: [1, 2] };
      const override: Record<string, unknown> = { items: [3, 4] };

      const result = mergeConfigs(base, override);

      expect((result.value as Record<string, unknown>).items).toEqual([
        1, 2, 3, 4,
      ]);
      expect(result.conflicts.length).toBe(1);
      expect(result.conflicts[0]?.reason).toContain("append");
    });

    it("does not overwrite arrays by default", () => {
      const base = { items: ["a", "b"] };
      const override = { items: ["c"] };

      const result = mergeConfigs(base, override);

      expect(result.value.items).toEqual(["a", "b", "c"]);
    });

    it("allows array overwrite when explicitly enabled", () => {
      const base = { items: ["a", "b"] };
      const override = { items: ["c"] };

      const result = mergeConfigs(base, override, {
        allowArrayOverwrite: true,
      });

      expect(result.value.items).toEqual(["c"]);
    });

    it("deep merges nested objects", () => {
      const base: Record<string, unknown> = {
        nested: {
          field1: "a",
          field2: "b",
        },
      };
      const override: Record<string, unknown> = {
        nested: {
          field2: "c",
          field3: "d",
        },
      };

      const result = mergeConfigs(base, override);

      const nested = (result.value as Record<string, unknown>).nested as Record<
        string,
        unknown
      >;
      expect(nested.field1).toBe("a");
      expect(nested.field2).toBe("c");
      expect(nested.field3).toBe("d");
    });

    it("handles null/undefined as not set", () => {
      const base: Record<string, unknown> = {
        value: "base",
        nullable: undefined,
      };
      const override: Record<string, unknown> = {
        value: null,
        nullable: "override",
      };

      const result = mergeConfigs(base, override);

      expect((result.value as Record<string, unknown>).value).toBe(null);
      expect((result.value as Record<string, unknown>).nullable).toBe(
        "override",
      );
    });

    it("detects conflicts in scalar overwrites", () => {
      const base: Record<string, unknown> = { debug: true };
      const override: Record<string, unknown> = { debug: false };

      const result = mergeConfigs(base, override);

      expect(result.conflicts).toHaveLength(1);
      expect(result.conflicts[0]?.path).toBe("debug");
      expect(result.conflicts[0]?.baseValue).toBe(true);
      expect(result.conflicts[0]?.overrideValue).toBe(false);
    });

    it("detects conflicts in array appends", () => {
      const base = { excludes: ["*.test.ts"] };
      const override = { excludes: ["node_modules"] };

      const result = mergeConfigs(base, override);

      expect(result.conflicts).toHaveLength(1);
      expect(result.conflicts[0]?.reason).toContain("append");
    });

    it("throws on type mismatch (array vs object)", () => {
      const base: Record<string, unknown> = { data: [1, 2] };
      const override: Record<string, unknown> = { data: { nested: true } };

      expect(() => mergeConfigs(base, override)).toThrow();
    });

    it("tracks conflict paths for nested objects", () => {
      const base: Record<string, unknown> = {
        level1: {
          level2: {
            value: "a",
          },
        },
      };
      const override: Record<string, unknown> = {
        level1: {
          level2: {
            value: "b",
          },
        },
      };

      const result = mergeConfigs(base, override);

      expect(result.conflicts).toHaveLength(1);
      expect(result.conflicts[0]?.path).toBe("level1.level2.value");
    });
  });

  describe("Real Config Scenarios", () => {
    it("merges manifest configurations correctly", () => {
      const base: Record<string, unknown> = {
        manifest: {
          includeFileSha256: true,
          includeOutputSha256: true,
          includeOutputSpans: false,
        },
      };
      const override: Record<string, unknown> = {
        manifest: {
          includeOutputSpans: true,
        },
      };

      const result = mergeConfigs(base, override);

      const manifest = (result.value as Record<string, unknown>)
        .manifest as Record<string, unknown>;
      expect(manifest.includeFileSha256).toBe(true);
      expect(manifest.includeOutputSha256).toBe(true);
      expect(manifest.includeOutputSpans).toBe(true);
    });

    it("merges section configurations with conflict detection", () => {
      const base: Record<string, unknown> = {
        sections: {
          docs: {
            include: ["docs/**"],
            exclude: ["docs/draft"],
          },
          src: {
            include: ["src/**"],
            exclude: [],
          },
        },
      };
      const override: Record<string, unknown> = {
        sections: {
          docs: {
            exclude: ["docs/archive"],
          },
        },
      };

      const result = mergeConfigs(base, override);

      const sections = (result.value as Record<string, unknown>)
        .sections as Record<string, unknown>;
      const docs = sections.docs as Record<string, unknown>;
      expect(docs.include).toEqual(["docs/**"]);
      expect(docs.exclude).toEqual(["docs/draft", "docs/archive"]);
      expect(sections.src).toBeDefined();
    });

    it("appends file include/exclude patterns", () => {
      const base: Record<string, unknown> = {
        files: {
          include: ["generated/**"],
          exclude: ["*.tmp"],
        },
      };
      const override: Record<string, unknown> = {
        files: {
          include: ["dist/**"],
          exclude: ["*.bak"],
        },
      };

      const result = mergeConfigs(base, override);

      const files = (result.value as Record<string, unknown>).files as Record<
        string,
        unknown
      >;
      expect(files.include).toEqual(["generated/**", "dist/**"]);
      expect(files.exclude).toEqual(["*.tmp", "*.bak"]);
      expect(result.conflicts.length).toBe(2); // Two conflicts for the two appends
    });
  });

  describe("validateMergeConfig", () => {
    it("validates correct config", () => {
      const config = {
        extends: "base.toml",
        sections: {},
      };

      const result = validateMergeConfig(config);

      expect(result.valid).toBe(true);
      expect(result.errors.length).toBe(0);
    });

    it("rejects deep extends chains", () => {
      const config = {
        extends: {
          extends: "base.toml",
        },
      };

      const result = validateMergeConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain("Deep extends");
    });

    it("validates non-object configs", () => {
      expect(validateMergeConfig("string").valid).toBe(true);
      expect(validateMergeConfig(123).valid).toBe(true);
      expect(validateMergeConfig(null).valid).toBe(true);
      expect(validateMergeConfig(undefined).valid).toBe(true);
    });
  });

  describe("Conflict Reporting", () => {
    it("provides clear conflict information", () => {
      const base: Record<string, unknown> = { debug: false, timeout: 30 };
      const override: Record<string, unknown> = { debug: true, timeout: 60 };

      const result = mergeConfigs(base, override);

      expect(result.conflicts.length).toBe(2);

      const debugConflict = result.conflicts.find((c) => c.path === "debug");
      expect(debugConflict).toBeDefined();
      expect(debugConflict?.baseValue).toBe(false);
      expect(debugConflict?.overrideValue).toBe(true);
      expect(debugConflict?.reason).toContain("scalar");
    });

    it("tracks root-level conflicts", () => {
      const base: Record<string, unknown> = { root: "a" };
      const override: Record<string, unknown> = { root: "b" };

      const result = mergeConfigs(base, override);

      expect(result.conflicts[0]?.path).toBe("root");
    });
  });

  describe("Array Merge Edge Cases", () => {
    it("handles empty arrays", () => {
      const base: Record<string, unknown> = { items: [] };
      const override: Record<string, unknown> = { items: [1] };

      const result = mergeConfigs(base, override);

      expect((result.value as Record<string, unknown>).items).toEqual([1]);
      expect(result.conflicts.length).toBe(0);
    });

    it("appends when both arrays are non-empty", () => {
      const base: Record<string, unknown> = { items: [1] };
      const override: Record<string, unknown> = { items: [2] };

      const result = mergeConfigs(base, override);

      expect((result.value as Record<string, unknown>).items).toEqual([1, 2]);
      expect(result.conflicts.length).toBe(1);
    });

    it("preserves array types during append", () => {
      const base: Record<string, unknown> = { items: ["a"] };
      const override: Record<string, unknown> = { items: ["b"] };

      const result = mergeConfigs(base, override);

      expect(
        Array.isArray((result.value as Record<string, unknown>).items),
      ).toBe(true);
      expect((result.value as Record<string, unknown>).items).toEqual([
        "a",
        "b",
      ]);
    });
  });
});
