// test-lane: unit
import { describe, expect, it } from "vitest";
import {
  DEFAULT_BEHAVIOR_VALUES,
  DEFAULT_CONFIG_TEMPLATE,
  DEFAULT_CONFIG_VALUES,
  DEFAULT_STYLE,
  DEFAULT_USER_CONFIG_TEMPLATE,
  DEFAULT_USER_CONFIG_VALUES,
} from "../../src/config/defaults.js";

describe("config defaults", () => {
  describe("DEFAULT_STYLE", () => {
    it("defaults to xml", () => {
      expect(DEFAULT_STYLE).toBe("xml");
    });
  });

  describe("DEFAULT_BEHAVIOR_VALUES", () => {
    it("has repomixMissingExtension set to warn", () => {
      expect(DEFAULT_BEHAVIOR_VALUES.repomixMissingExtension).toBe("warn");
    });

    it("has configDuplicateEntry set to fail", () => {
      expect(DEFAULT_BEHAVIOR_VALUES.configDuplicateEntry).toBe("fail");
    });

    it("includes all expected behavior keys", () => {
      expect(Object.keys(DEFAULT_BEHAVIOR_VALUES)).toEqual([
        "repomixMissingExtension",
        "configDuplicateEntry",
      ]);
    });

    it("values are read-only string literals", () => {
      expect(typeof DEFAULT_BEHAVIOR_VALUES.repomixMissingExtension).toBe(
        "string",
      );
      expect(typeof DEFAULT_BEHAVIOR_VALUES.configDuplicateEntry).toBe(
        "string",
      );
    });
  });

  describe("DEFAULT_CONFIG_VALUES", () => {
    it("includes output extensions", () => {
      expect(DEFAULT_CONFIG_VALUES.output.extensions.xml).toBe(".xml.txt");
      expect(DEFAULT_CONFIG_VALUES.output.extensions.json).toBe(".json.txt");
      expect(DEFAULT_CONFIG_VALUES.output.extensions.markdown).toBe(".md");
      expect(DEFAULT_CONFIG_VALUES.output.extensions.plain).toBe(".txt");
    });

    it("includes repomix settings", () => {
      expect(DEFAULT_CONFIG_VALUES.repomix.style).toBe("xml");
      expect(DEFAULT_CONFIG_VALUES.repomix.showLineNumbers).toBe(false);
      expect(DEFAULT_CONFIG_VALUES.repomix.includeEmptyDirectories).toBe(false);
      expect(DEFAULT_CONFIG_VALUES.repomix.securityCheck).toBe(true);
    });

    it("includes file handling settings", () => {
      expect(DEFAULT_CONFIG_VALUES.files.include).toEqual([]);
      expect(DEFAULT_CONFIG_VALUES.files.exclude).toContain("node_modules/**");
      expect(DEFAULT_CONFIG_VALUES.files.followSymlinks).toBe(false);
      expect(DEFAULT_CONFIG_VALUES.files.unmatched).toBe("ignore");
    });

    it("includes deduplication settings", () => {
      expect(DEFAULT_CONFIG_VALUES.dedup.mode).toBe("fail");
      expect(DEFAULT_CONFIG_VALUES.dedup.order).toBe("config");
    });

    it("includes manifest settings", () => {
      expect(DEFAULT_CONFIG_VALUES.manifest.format).toBe("json");
      expect(DEFAULT_CONFIG_VALUES.manifest.pretty).toBe(true);
      expect(DEFAULT_CONFIG_VALUES.manifest.includeFileSha256).toBe(true);
      expect(DEFAULT_CONFIG_VALUES.manifest.includeOutputSha256).toBe(true);
      expect(DEFAULT_CONFIG_VALUES.manifest.includeOutputSpans).toBe(true);
      expect(DEFAULT_CONFIG_VALUES.manifest.includeSourceMetadata).toBe(true);
      expect(DEFAULT_CONFIG_VALUES.manifest.includeLinkedNotes).toBe(false);
    });

    it("includes shared handover settings", () => {
      expect(DEFAULT_CONFIG_VALUES.handover.includeRepoHistory).toBe(false);
      expect(DEFAULT_CONFIG_VALUES.handover.repoHistoryCount).toBe(25);
    });

    it("includes notes gating settings", () => {
      expect(DEFAULT_CONFIG_VALUES.notes.strictNotesMode).toBe(false);
      expect(DEFAULT_CONFIG_VALUES.notes.failOnDriftPressuredNotes).toBe(false);
      expect(DEFAULT_CONFIG_VALUES.notes.appliesToSections).toEqual([]);
    });

    it("includes scanner settings", () => {
      expect(DEFAULT_CONFIG_VALUES.scanner.mode).toBe("warn");
      expect(DEFAULT_CONFIG_VALUES.scanner.ids).toEqual(["reference_secrets"]);
      expect(DEFAULT_CONFIG_VALUES.scanner.includePostPackArtifacts).toBe(
        false,
      );
    });

    it("includes checksum settings", () => {
      expect(DEFAULT_CONFIG_VALUES.checksums.algorithm).toBe("sha256");
      expect(DEFAULT_CONFIG_VALUES.checksums.fileName).toBe("{project}.sha256");
    });

    it("includes token encoding", () => {
      expect(DEFAULT_CONFIG_VALUES.tokens.encoding).toBe("o200k_base");
    });

    it("includes asset settings", () => {
      expect(DEFAULT_CONFIG_VALUES.assets.mode).toBe("copy");
      expect(DEFAULT_CONFIG_VALUES.assets.layout).toBe("flat");
      expect(DEFAULT_CONFIG_VALUES.assets.targetDir).toBe("{project}-assets");
      expect(DEFAULT_CONFIG_VALUES.assets.include.length).toBeGreaterThan(0);
    });

    it("includes behavior values", () => {
      expect(DEFAULT_CONFIG_VALUES.behavior.repomixMissingExtension).toBe(
        "warn",
      );
      expect(DEFAULT_CONFIG_VALUES.behavior.configDuplicateEntry).toBe("fail");
    });

    it("file exclude patterns include standard directories", () => {
      expect(DEFAULT_CONFIG_VALUES.files.exclude).toContain("dist/**");
      expect(DEFAULT_CONFIG_VALUES.files.exclude).toContain("tmp/**");
    });

    it("asset include patterns cover common image formats", () => {
      const assetPatterns = DEFAULT_CONFIG_VALUES.assets.include.join("");
      expect(assetPatterns).toContain("png");
      expect(assetPatterns).toContain("jpg");
      expect(assetPatterns).toContain("gif");
      expect(assetPatterns).toContain("svg");
      expect(assetPatterns).toContain("pdf");
    });

    it("defaults are not mutated", () => {
      const original = JSON.stringify(DEFAULT_CONFIG_VALUES);
      // Access defaults multiple times
      void DEFAULT_CONFIG_VALUES.files.exclude;
      void DEFAULT_CONFIG_VALUES.output.extensions;
      // Should still be identical
      expect(JSON.stringify(DEFAULT_CONFIG_VALUES)).toBe(original);
    });
  });

  describe("DEFAULT_CONFIG_TEMPLATE", () => {
    it("is a non-empty string", () => {
      expect(typeof DEFAULT_CONFIG_TEMPLATE).toBe("string");
      expect(DEFAULT_CONFIG_TEMPLATE.length).toBeGreaterThan(0);
    });

    it("contains schema reference", () => {
      expect(DEFAULT_CONFIG_TEMPLATE).toContain("schema");
    });

    it("contains required config sections", () => {
      expect(DEFAULT_CONFIG_TEMPLATE).toContain("[output");
      expect(DEFAULT_CONFIG_TEMPLATE).toContain("[repomix");
      expect(DEFAULT_CONFIG_TEMPLATE).toContain("[files");
      expect(DEFAULT_CONFIG_TEMPLATE).toContain("[dedup");
      expect(DEFAULT_CONFIG_TEMPLATE).toContain("[manifest");
      expect(DEFAULT_CONFIG_TEMPLATE).toContain("[sections");
    });

    it("contains section definitions", () => {
      expect(DEFAULT_CONFIG_TEMPLATE).toContain("[sections.docs");
      expect(DEFAULT_CONFIG_TEMPLATE).toContain("[sections.repo");
      expect(DEFAULT_CONFIG_TEMPLATE).toContain("[sections.src");
      expect(DEFAULT_CONFIG_TEMPLATE).toContain("[sections.tests");
    });

    it("contains project metadata", () => {
      expect(DEFAULT_CONFIG_TEMPLATE).toContain("project_name");
      expect(DEFAULT_CONFIG_TEMPLATE).toContain("source_root");
      expect(DEFAULT_CONFIG_TEMPLATE).toContain("output_dir");
    });

    it("contains helpful comments", () => {
      expect(DEFAULT_CONFIG_TEMPLATE).toContain("#");
    });

    it("references standard file extensions", () => {
      expect(DEFAULT_CONFIG_TEMPLATE).toContain(".xml.txt");
      expect(DEFAULT_CONFIG_TEMPLATE).toContain(".json.txt");
    });
  });

  describe("DEFAULT_USER_CONFIG_VALUES", () => {
    it("includes display configuration", () => {
      expect(DEFAULT_USER_CONFIG_VALUES.display).toBeDefined();
      expect(DEFAULT_USER_CONFIG_VALUES.display.list).toBeDefined();
    });

    it("display list includes warmth thresholds", () => {
      const displayList = DEFAULT_USER_CONFIG_VALUES.display.list;
      expect(displayList.bytesWarm).toBeGreaterThan(0);
      expect(displayList.bytesHot).toBeGreaterThan(displayList.bytesWarm);
      expect(displayList.tokensWarm).toBeGreaterThan(0);
      expect(displayList.tokensHot).toBeGreaterThan(displayList.tokensWarm);
    });

    it("display list includes time thresholds", () => {
      const displayList = DEFAULT_USER_CONFIG_VALUES.display.list;
      expect(displayList.mtimeWarmMinutes).toBeGreaterThan(0);
      expect(displayList.mtimeHotHours).toBeGreaterThan(0);
    });

    it("display list includes time palette", () => {
      const displayList = DEFAULT_USER_CONFIG_VALUES.display.list;
      expect(Array.isArray(displayList.timePalette)).toBe(true);
      expect(displayList.timePalette.length).toBeGreaterThan(0);
      // Palette values should be valid color codes
      expect(displayList.timePalette.every((v) => v >= 0 && v <= 255)).toBe(
        true,
      );
    });
  });

  describe("DEFAULT_USER_CONFIG_TEMPLATE", () => {
    it("is a non-empty string", () => {
      expect(typeof DEFAULT_USER_CONFIG_TEMPLATE).toBe("string");
      expect(DEFAULT_USER_CONFIG_TEMPLATE.length).toBeGreaterThan(0);
    });

    it("contains display list section", () => {
      expect(DEFAULT_USER_CONFIG_TEMPLATE).toContain("[display.list");
    });

    it("contains warmth configuration", () => {
      expect(DEFAULT_USER_CONFIG_TEMPLATE).toContain("bytes_warm");
      expect(DEFAULT_USER_CONFIG_TEMPLATE).toContain("tokens_warm");
      expect(DEFAULT_USER_CONFIG_TEMPLATE).toContain("mtime_warm_minutes");
    });

    it("contains hotness configuration", () => {
      expect(DEFAULT_USER_CONFIG_TEMPLATE).toContain("bytes_hot");
      expect(DEFAULT_USER_CONFIG_TEMPLATE).toContain("tokens_hot");
      expect(DEFAULT_USER_CONFIG_TEMPLATE).toContain("mtime_hot_hours");
    });

    it("contains time palette definition", () => {
      expect(DEFAULT_USER_CONFIG_TEMPLATE).toContain("time_palette");
    });
  });

  describe("config defaults consistency", () => {
    it("template references match config values for output extensions", () => {
      expect(DEFAULT_CONFIG_TEMPLATE).toContain(
        DEFAULT_CONFIG_VALUES.output.extensions.xml,
      );
      expect(DEFAULT_CONFIG_TEMPLATE).toContain(
        DEFAULT_CONFIG_VALUES.output.extensions.json,
      );
    });

    it("template references match dedup values", () => {
      expect(DEFAULT_CONFIG_TEMPLATE).toContain('mode = "fail"');
      expect(DEFAULT_CONFIG_TEMPLATE).toContain('order = "config"');
    });

    it("behavior values are included in config values", () => {
      expect(DEFAULT_CONFIG_VALUES.behavior).toEqual(DEFAULT_BEHAVIOR_VALUES);
    });

    it("user config defaults have sensible values", () => {
      const displayList = DEFAULT_USER_CONFIG_VALUES.display.list;
      // Hot should be larger than warm
      expect(displayList.bytesHot).toBeGreaterThan(displayList.bytesWarm);
      expect(displayList.tokensHot).toBeGreaterThan(displayList.tokensWarm);
      expect(displayList.mtimeHotHours).toBeGreaterThan(
        displayList.mtimeWarmMinutes / 60,
      );
    });
  });
});
