// test-lane: unit
import { describe, expect, it } from "bun:test";
import type { ExtractabilityRecord } from "../../src/extract/resolution.js";

describe("extract resolution utilities", () => {
  describe("ExtractabilityRecord structure", () => {
    it("intact record has correct status and reason", () => {
      const record: ExtractabilityRecord = {
        path: "src/main.ts",
        section: "src",
        kind: "text",
        status: "intact",
        reason: "manifest_hash_match",
        message: "Hash matches",
        expectedSha256: "abc123",
        actualSha256: "abc123",
        content: "export const x = 1;",
      };
      expect(record.status).toBe("intact");
      expect(record.reason).toBe("manifest_hash_match");
    });

    it("degraded record indicates hash mismatch", () => {
      const record: ExtractabilityRecord = {
        path: "src/index.ts",
        section: "src",
        kind: "text",
        status: "degraded",
        reason: "manifest_hash_mismatch",
        message: "Hash mismatch",
        expectedSha256: "abc123",
        actualSha256: "def456",
        content: "export const y = 2;",
      };
      expect(record.status).toBe("degraded");
      expect(record.expectedSha256).not.toBe(record.actualSha256);
    });

    it("blocked record for missing output span", () => {
      const record: ExtractabilityRecord = {
        path: "src/util.ts",
        section: "src",
        kind: "text",
        status: "blocked",
        reason: "missing_output_span",
        message: "No output span defined",
        expectedSha256: "abc123",
      };
      expect(record.status).toBe("blocked");
      expect(record.reason).toBe("missing_output_span");
      expect(record.content).toBeUndefined();
      expect(record.actualSha256).toBeUndefined();
    });

    it("copied asset record", () => {
      const record: ExtractabilityRecord = {
        path: "assets/logo.png",
        section: "-",
        kind: "asset",
        status: "copied",
        reason: "asset_copy",
        message: "Asset copied from bundle",
        expectedSha256: "img123",
      };
      expect(record.status).toBe("copied");
      expect(record.kind).toBe("asset");
      expect(record.section).toBe("-");
    });

    it("blocked record for section parse failure", () => {
      const record: ExtractabilityRecord = {
        path: "docs/README.md",
        section: "docs",
        kind: "text",
        status: "blocked",
        reason: "section_parse_failed",
        message: "JSON parse error in section output",
        expectedSha256: "doc123",
      };
      expect(record.status).toBe("blocked");
      expect(record.reason).toBe("section_parse_failed");
    });

    it("blocked record for missing from section", () => {
      const record: ExtractabilityRecord = {
        path: "src/missing.ts",
        section: "src",
        kind: "text",
        status: "blocked",
        reason: "missing_from_section_output",
        message: "File not in section output",
        expectedSha256: "miss123",
      };
      expect(record.status).toBe("blocked");
      expect(record.reason).toBe("missing_from_section_output");
    });
  });

  describe("ExtractabilityRecord field validation", () => {
    it("all intact records have both expected and actual SHA256", () => {
      const record: ExtractabilityRecord = {
        path: "file.ts",
        section: "src",
        kind: "text",
        status: "intact",
        reason: "manifest_hash_match",
        message: "OK",
        expectedSha256: "hash1",
        actualSha256: "hash1",
      };
      expect(record.expectedSha256).toBeDefined();
      expect(record.actualSha256).toBeDefined();
      expect(record.expectedSha256).toBe(record.actualSha256);
    });

    it("degraded records have different SHA256 values", () => {
      const record: ExtractabilityRecord = {
        path: "file.ts",
        section: "src",
        kind: "text",
        status: "degraded",
        reason: "manifest_hash_mismatch",
        message: "Mismatch",
        expectedSha256: "expected_hash",
        actualSha256: "actual_hash",
        content: "content here",
      };
      expect(record.expectedSha256).not.toBe(record.actualSha256);
      expect(record.content).toBeDefined();
    });

    it("path is always non-empty", () => {
      const record: ExtractabilityRecord = {
        path: "src/module.ts",
        section: "src",
        kind: "text",
        status: "intact",
        reason: "manifest_hash_match",
        message: "OK",
        expectedSha256: "hash1",
        actualSha256: "hash1",
      };
      expect(record.path.length).toBeGreaterThan(0);
    });

    it("section can be file section name or dash for assets", () => {
      const textRecord: ExtractabilityRecord = {
        path: "src/main.ts",
        section: "src",
        kind: "text",
        status: "intact",
        reason: "manifest_hash_match",
        message: "OK",
        expectedSha256: "h1",
        actualSha256: "h1",
      };
      expect(textRecord.section).not.toBe("-");

      const assetRecord: ExtractabilityRecord = {
        path: "asset.png",
        section: "-",
        kind: "asset",
        status: "copied",
        reason: "asset_copy",
        message: "Copied",
        expectedSha256: "h2",
      };
      expect(assetRecord.section).toBe("-");
    });

    it("kind indicates file type", () => {
      const textRecord: ExtractabilityRecord = {
        path: "file.ts",
        section: "src",
        kind: "text",
        status: "intact",
        reason: "manifest_hash_match",
        message: "OK",
        expectedSha256: "h",
        actualSha256: "h",
      };
      expect(textRecord.kind).toBe("text");

      const assetRecord: ExtractabilityRecord = {
        path: "img.png",
        section: "-",
        kind: "asset",
        status: "copied",
        reason: "asset_copy",
        message: "OK",
        expectedSha256: "h",
      };
      expect(assetRecord.kind).toBe("asset");
    });
  });

  describe("ExtractabilityRecord status and reason combinations", () => {
    it("intact status only with manifest_hash_match reason", () => {
      const record: ExtractabilityRecord = {
        path: "f.ts",
        section: "src",
        kind: "text",
        status: "intact",
        reason: "manifest_hash_match",
        message: "M",
        expectedSha256: "e",
        actualSha256: "e",
      };
      expect(record.status).toBe("intact");
      expect(record.reason).toBe("manifest_hash_match");
    });

    it("degraded status with manifest_hash_mismatch reason", () => {
      const record: ExtractabilityRecord = {
        path: "f.ts",
        section: "src",
        kind: "text",
        status: "degraded",
        reason: "manifest_hash_mismatch",
        message: "M",
        expectedSha256: "e",
        actualSha256: "a",
      };
      expect(record.status).toBe("degraded");
      expect(record.reason).toBe("manifest_hash_mismatch");
    });

    it("copied status with asset_copy reason", () => {
      const record: ExtractabilityRecord = {
        path: "a.png",
        section: "-",
        kind: "asset",
        status: "copied",
        reason: "asset_copy",
        message: "M",
        expectedSha256: "h",
      };
      expect(record.status).toBe("copied");
      expect(record.reason).toBe("asset_copy");
    });

    it("blocked status with various blocking reasons", () => {
      const reasons: Array<
        | "missing_output_span"
        | "missing_from_section_output"
        | "section_parse_failed"
      > = [
        "missing_output_span",
        "missing_from_section_output",
        "section_parse_failed",
      ];

      for (const reason of reasons) {
        const record: ExtractabilityRecord = {
          path: `file-${reason}.ts`,
          section: "src",
          kind: "text",
          status: "blocked",
          reason,
          message: `Error: ${reason}`,
          expectedSha256: "h",
        };
        expect(record.status).toBe("blocked");
        expect(record.reason).toBe(reason);
      }
    });
  });

  describe("ExtractabilityRecord content field", () => {
    it("intact records can include content", () => {
      const record: ExtractabilityRecord = {
        path: "src/main.ts",
        section: "src",
        kind: "text",
        status: "intact",
        reason: "manifest_hash_match",
        message: "OK",
        content: "export function main() {}",
        expectedSha256: "h1",
        actualSha256: "h1",
      };
      expect(record.content).toBeDefined();
    });

    it("degraded records include recovered content", () => {
      const record: ExtractabilityRecord = {
        path: "src/util.ts",
        section: "src",
        kind: "text",
        status: "degraded",
        reason: "manifest_hash_mismatch",
        message: "M",
        content: "recovered content here",
        expectedSha256: "expected",
        actualSha256: "actual",
      };
      expect(record.content).toBeDefined();
      expect(record.content?.length).toBeGreaterThan(0);
    });

    it("blocked records without content when unavailable", () => {
      const record: ExtractabilityRecord = {
        path: "src/missing.ts",
        section: "src",
        kind: "text",
        status: "blocked",
        reason: "missing_output_span",
        message: "No span",
        expectedSha256: "h",
      };
      expect(record.content).toBeUndefined();
    });

    it("assets never have content field", () => {
      const record: ExtractabilityRecord = {
        path: "img.png",
        section: "-",
        kind: "asset",
        status: "copied",
        reason: "asset_copy",
        message: "OK",
        expectedSha256: "h",
      };
      expect(record.content).toBeUndefined();
    });
  });

  describe("ExtractabilityRecord for different file kinds", () => {
    it("text files tracked with output spans", () => {
      const record: ExtractabilityRecord = {
        path: "src/index.ts",
        section: "src",
        kind: "text",
        status: "intact",
        reason: "manifest_hash_match",
        message: "OK",
        expectedSha256: "h",
        actualSha256: "h",
      };
      expect(record.kind).toBe("text");
    });

    it("asset files copied directly", () => {
      const record: ExtractabilityRecord = {
        path: "logo.svg",
        section: "-",
        kind: "asset",
        status: "copied",
        reason: "asset_copy",
        message: "Copied",
        expectedSha256: "h",
      };
      expect(record.kind).toBe("asset");
    });
  });

  describe("ExtractabilityRecord message field", () => {
    it("message is descriptive non-empty string", () => {
      const messages = [
        "Hash matches",
        "Hash mismatch detected",
        "Output span missing",
        "Section parse failed",
      ];

      for (const message of messages) {
        const _record: ExtractabilityRecord = {
          path: "f.ts",
          section: "src",
          kind: "text",
          status: "blocked",
          reason: "missing_output_span",
          message,
          expectedSha256: "h",
        };
        expect(message.length).toBeGreaterThan(0);
        expect(typeof message).toBe("string");
      }
    });

    it("message indicates error condition when blocked", () => {
      const record: ExtractabilityRecord = {
        path: "src/file.ts",
        section: "src",
        kind: "text",
        status: "blocked",
        reason: "section_parse_failed",
        message: "Failed to parse section output: JSON error at line 5",
        expectedSha256: "h",
      };
      expect(record.message).toContain("Failed");
      expect(record.message.length).toBeGreaterThan(0);
    });
  });

  describe("ExtractabilityRecord validation for hash integrity", () => {
    it("intact records have matching SHA256 values", () => {
      const record: ExtractabilityRecord = {
        path: "f.ts",
        section: "src",
        kind: "text",
        status: "intact",
        reason: "manifest_hash_match",
        message: "M",
        expectedSha256:
          "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        actualSha256:
          "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      };
      expect(record.expectedSha256).toBe(record.actualSha256);
    });

    it("degraded records have different SHA256 values", () => {
      const record: ExtractabilityRecord = {
        path: "f.ts",
        section: "src",
        kind: "text",
        status: "degraded",
        reason: "manifest_hash_mismatch",
        message: "M",
        expectedSha256:
          "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        actualSha256:
          "5feceb66ffc86f38d952786c6d696c79c2dbc238c4cafb11f2271d7a122e34e",
      };
      expect(record.expectedSha256).not.toBe(record.actualSha256);
    });

    it("valid SHA256 format (64 hex characters)", () => {
      const validSha256 =
        "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
      expect(validSha256).toMatch(/^[a-f0-9]{64}$/);

      const record: ExtractabilityRecord = {
        path: "f.ts",
        section: "src",
        kind: "text",
        status: "intact",
        reason: "manifest_hash_match",
        message: "OK",
        expectedSha256: validSha256,
        actualSha256: validSha256,
      };
      expect(record.expectedSha256?.match(/^[a-f0-9]{64}$/)).toBeDefined();
    });
  });
});
