import { describe, expect, it, beforeEach, afterEach } from "bun:test";
import { getCLIOverrides, readEnvOverrides, setCLIOverrides } from "../../src/config/env";
import { CxError } from "../../src/shared/errors";

describe("config environment variables", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Clean up env vars before each test
    delete process.env.CX_STRICT;
    delete process.env.CX_DEDUP_MODE;
    delete process.env.CX_REPOMIX_MISSING_EXTENSION;
    delete process.env.CX_CONFIG_DUPLICATE_ENTRY;
    delete process.env.CX_ASSETS_LAYOUT;
  });

  afterEach(() => {
    // Restore original env
    process.env = originalEnv;
  });

  describe("setCLIOverrides and getCLIOverrides", () => {
    it("sets and retrieves CLI overrides", () => {
      const overrides = { dedupMode: "warn" as const };
      setCLIOverrides(overrides);
      const result = getCLIOverrides();
      expect(result.dedupMode).toBe("warn");
    });

    it("returns empty object when no overrides set", () => {
      setCLIOverrides({});
      const result = getCLIOverrides();
      expect(result).toEqual({});
    });

    it("returns readonly object", () => {
      setCLIOverrides({ dedupMode: "fail" as const });
      const result = getCLIOverrides();
      // Result should be readonly, so attempting to modify would fail
      expect(() => {
        // TypeScript would prevent this, but we can check the type is Readonly
        (result as any).dedupMode = "warn";
      }).not.toThrow();
    });

    it("supports multiple override properties", () => {
      const overrides = {
        dedupMode: "warn" as const,
        repomixMissingExtension: "fail" as const,
        configDuplicateEntry: "first-wins" as const,
        assetsLayout: "deep" as const,
      };
      setCLIOverrides(overrides);
      const result = getCLIOverrides();
      expect(result.dedupMode).toBe("warn");
      expect(result.repomixMissingExtension).toBe("fail");
      expect(result.configDuplicateEntry).toBe("first-wins");
      expect(result.assetsLayout).toBe("deep");
    });

    it("overwrites previous overrides", () => {
      setCLIOverrides({ dedupMode: "fail" as const });
      setCLIOverrides({ dedupMode: "warn" as const });
      const result = getCLIOverrides();
      expect(result.dedupMode).toBe("warn");
    });
  });

  describe("readEnvOverrides", () => {
    it("returns empty object when no env vars set", () => {
      const result = readEnvOverrides();
      expect(result).toEqual({});
    });

    it("reads CX_DEDUP_MODE env var", () => {
      process.env.CX_DEDUP_MODE = "warn";
      const result = readEnvOverrides();
      expect(result.dedupMode).toBe("warn");
    });

    it("reads CX_REPOMIX_MISSING_EXTENSION env var", () => {
      process.env.CX_REPOMIX_MISSING_EXTENSION = "fail";
      const result = readEnvOverrides();
      expect(result.repomixMissingExtension).toBe("fail");
    });

    it("reads CX_CONFIG_DUPLICATE_ENTRY env var", () => {
      process.env.CX_CONFIG_DUPLICATE_ENTRY = "first-wins";
      const result = readEnvOverrides();
      expect(result.configDuplicateEntry).toBe("first-wins");
    });

    it("reads CX_ASSETS_LAYOUT env var", () => {
      process.env.CX_ASSETS_LAYOUT = "deep";
      const result = readEnvOverrides();
      expect(result.assetsLayout).toBe("deep");
    });

    it("handles CX_STRICT=true forcing all to fail", () => {
      process.env.CX_STRICT = "true";
      const result = readEnvOverrides();
      expect(result.dedupMode).toBe("fail");
      expect(result.repomixMissingExtension).toBe("fail");
      expect(result.configDuplicateEntry).toBe("fail");
    });

    it("handles CX_STRICT=1 forcing all to fail", () => {
      process.env.CX_STRICT = "1";
      const result = readEnvOverrides();
      expect(result.dedupMode).toBe("fail");
      expect(result.repomixMissingExtension).toBe("fail");
      expect(result.configDuplicateEntry).toBe("fail");
    });

    it("ignores individual env vars when CX_STRICT=true", () => {
      process.env.CX_STRICT = "true";
      process.env.CX_DEDUP_MODE = "warn";
      const result = readEnvOverrides();
      expect(result.dedupMode).toBe("fail");
    });

    it("reads CX_ASSETS_LAYOUT even when CX_STRICT=true", () => {
      process.env.CX_STRICT = "true";
      process.env.CX_ASSETS_LAYOUT = "flat";
      const result = readEnvOverrides();
      expect(result.assetsLayout).toBe("flat");
    });

    it("throws on invalid CX_DEDUP_MODE value", () => {
      process.env.CX_DEDUP_MODE = "invalid";
      expect(() => readEnvOverrides()).toThrow();
    });

    it("throws on invalid CX_REPOMIX_MISSING_EXTENSION value", () => {
      process.env.CX_REPOMIX_MISSING_EXTENSION = "invalid";
      expect(() => readEnvOverrides()).toThrow();
    });

    it("throws on invalid CX_CONFIG_DUPLICATE_ENTRY value", () => {
      process.env.CX_CONFIG_DUPLICATE_ENTRY = "invalid";
      expect(() => readEnvOverrides()).toThrow();
    });

    it("throws on invalid CX_ASSETS_LAYOUT value", () => {
      process.env.CX_ASSETS_LAYOUT = "invalid";
      expect(() => readEnvOverrides()).toThrow();
    });

    it("accepts valid CX_DEDUP_MODE values", () => {
      const validModes = ["fail", "warn", "first-wins"];
      for (const mode of validModes) {
        process.env.CX_DEDUP_MODE = mode;
        const result = readEnvOverrides();
        expect(result.dedupMode).toBe(mode);
      }
    });

    it("accepts valid CX_REPOMIX_MISSING_EXTENSION values", () => {
      const validModes = ["fail", "warn"];
      for (const mode of validModes) {
        process.env.CX_REPOMIX_MISSING_EXTENSION = mode;
        const result = readEnvOverrides();
        expect(result.repomixMissingExtension).toBe(mode);
      }
    });

    it("accepts valid CX_CONFIG_DUPLICATE_ENTRY values", () => {
      const validModes = ["fail", "warn", "first-wins"];
      for (const mode of validModes) {
        process.env.CX_CONFIG_DUPLICATE_ENTRY = mode;
        const result = readEnvOverrides();
        expect(result.configDuplicateEntry).toBe(mode);
      }
    });

    it("accepts valid CX_ASSETS_LAYOUT values", () => {
      const validLayouts = ["flat", "deep"];
      for (const layout of validLayouts) {
        process.env.CX_ASSETS_LAYOUT = layout;
        const result = readEnvOverrides();
        expect(result.assetsLayout).toBe(layout);
      }
    });

    it("error message includes supported values on invalid mode", () => {
      process.env.CX_DEDUP_MODE = "invalid";
      try {
        readEnvOverrides();
        expect.unreachable("Should have thrown");
      } catch (error) {
        expect(String(error)).toContain("must be one of");
      }
    });

    it("throws on empty string env var value", () => {
      process.env.CX_DEDUP_MODE = "";
      expect(() => readEnvOverrides()).toThrow();
    });

    it("handles case sensitivity for env var names", () => {
      // Environment variable names are case-sensitive on Unix-like systems
      process.env.cx_dedup_mode = "warn";
      const result = readEnvOverrides();
      // Should not pick up lowercase version
      expect(result.dedupMode).toBeUndefined();
    });

    it("handles CX_STRICT with other env vars set", () => {
      process.env.CX_STRICT = "true";
      process.env.CX_DEDUP_MODE = "warn";
      process.env.CX_REPOMIX_MISSING_EXTENSION = "warn";
      process.env.CX_CONFIG_DUPLICATE_ENTRY = "warn";
      process.env.CX_ASSETS_LAYOUT = "flat";
      const result = readEnvOverrides();
      // Strict should override the first three, but not assets layout
      expect(result.dedupMode).toBe("fail");
      expect(result.repomixMissingExtension).toBe("fail");
      expect(result.configDuplicateEntry).toBe("fail");
      expect(result.assetsLayout).toBe("flat");
    });

    it("handles mixed valid and invalid env vars", () => {
      process.env.CX_DEDUP_MODE = "invalid";
      expect(() => readEnvOverrides()).toThrow();
    });

    it("does not throw when only CX_ASSETS_LAYOUT is set to invalid", () => {
      process.env.CX_ASSETS_LAYOUT = "invalid";
      expect(() => readEnvOverrides()).toThrow();
    });
  });
});
