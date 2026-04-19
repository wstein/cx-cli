// test-lane: unit
import { describe, expect, it } from "vitest";
import {
  parseJsonSection,
  parseMarkdownSection,
  parsePlainSection,
  parseXmlSection,
} from "../../src/extract/parsers.js";

describe("extract parsers", () => {
  describe("parseXmlSection", () => {
    it("parses single file XML section", () => {
      const source = '<file path="test.txt">\ncontent here\n</file>\n';
      const result = parseXmlSection(source);
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ path: "test.txt", content: "content here" });
    });

    it("parses multiple files in XML section", () => {
      const source =
        '<file path="a.txt">\ncontentA\n</file>\n' +
        '<file path="b.txt">\ncontentB\n</file>\n';
      const result = parseXmlSection(source);
      expect(result).toHaveLength(2);
      expect(result[0]?.path).toBe("a.txt");
      expect(result[1]?.path).toBe("b.txt");
    });

    it("handles file paths with special characters", () => {
      const source = '<file path="src/my-file.js">\ncontent\n</file>\n';
      const result = parseXmlSection(source);
      expect(result[0]?.path).toBe("src/my-file.js");
    });

    it("handles multiline content within file tags", () => {
      const source = '<file path="code.js">\nline1\nline2\nline3\n</file>\n';
      const result = parseXmlSection(source);
      expect(result[0]?.content).toBe("line1\nline2\nline3");
    });

    it("strips trailing newline before closing tag", () => {
      const source = '<file path="test.txt">\nContent with trailing\n</file>\n';
      const result = parseXmlSection(source);
      expect(result[0]?.content).toBe("Content with trailing");
    });

    it("returns empty array for source with no files", () => {
      const source = "no files here";
      const result = parseXmlSection(source);
      expect(result).toEqual([]);
    });

    it("handles content without trailing newlines inside tags", () => {
      const source = '<file path="test.txt">\ncontent</file>\n';
      const result = parseXmlSection(source);
      expect(result[0]?.content).toBe("content");
    });

    it("throws on missing closing tag", () => {
      const source = '<file path="test.txt">\nno closing tag here';
      expect(() => parseXmlSection(source)).toThrow();
    });

    it("throws on malformed open tag (missing quote)", () => {
      const source = '<file path="test.txt>\ncontent\n</file>\n';
      expect(() => parseXmlSection(source)).toThrow();
    });

    it("handles whitespace on close tag line", () => {
      const source = '<file path="test.txt">\ncontent\n</file>  \t  \n';
      const result = parseXmlSection(source);
      expect(result[0]?.content).toBe("content");
    });

    it("throws on invalid path in file", () => {
      const source = '<file path="test.txt">\ninvalid\n</file>\n';
      // parseXmlSection should accept the path
      const result = parseXmlSection(source);
      expect(result[0]?.path).toBe("test.txt");
    });

    it("handles consecutive file tags with no space", () => {
      const source =
        '<file path="a.txt">\na\n</file>\n' +
        '<file path="b.txt">\nb\n</file>\n';
      const result = parseXmlSection(source);
      expect(result).toHaveLength(2);
    });

    it("handles file tags with empty content", () => {
      const source = '<file path="empty.txt">\n</file>\n';
      const result = parseXmlSection(source);
      expect(result[0]?.content).toBe("");
    });

    it("throws when XML section open tag is missing a closing quote", () => {
      const source = '<file path="broken.txt>\ncontent\n</file>\n';
      expect(() => parseXmlSection(source)).toThrow();
    });

    it("throws when XML section close tag never appears", () => {
      const source = '<file path="broken.txt">\ncontent\n';
      expect(() => parseXmlSection(source)).toThrow();
    });

    it("throws when XML section close tag has trailing text and no later close tag", () => {
      const source = '<file path="broken.txt">\ncontent\n</file>oops';
      expect(() => parseXmlSection(source)).toThrow();
    });

    it("skips over misleading close tags until the real one", () => {
      const source = '<file path="test.txt">\ncontent\n</file>oops\n</file>\n';
      const result = parseXmlSection(source);
      expect(result[0]?.content).toBe("content\n</file>oops");
    });

    it("throws when a misleading close tag is never followed by a real close", () => {
      const source = '<file path="test.txt">\ncontent\n</file>oops';
      expect(() => parseXmlSection(source)).toThrow();
    });

    it("throws when multiple misleading close tags never resolve", () => {
      const source =
        '<file path="test.txt">\ncontent\n</file>oops\n</file>still-no-close';
      expect(() => parseXmlSection(source)).toThrow();
    });
  });

  describe("parseJsonSection", () => {
    it("parses simple JSON section", () => {
      const source = JSON.stringify({
        files: { "test.txt": "content" },
      });
      const result = parseJsonSection(source);
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ path: "test.txt", content: "content" });
    });

    it("parses multiple files in JSON section", () => {
      const source = JSON.stringify({
        files: {
          "a.txt": "contentA",
          "b.txt": "contentB",
        },
      });
      const result = parseJsonSection(source);
      expect(result).toHaveLength(2);
      expect(result.map((f) => f.path).sort()).toEqual(["a.txt", "b.txt"]);
    });

    it("throws on invalid JSON", () => {
      const source = "{invalid json}";
      expect(() => parseJsonSection(source)).toThrow();
    });

    it("throws when files field is missing", () => {
      const source = JSON.stringify({});
      expect(() => parseJsonSection(source)).toThrow();
    });

    it("throws when files is null", () => {
      const source = JSON.stringify({
        files: null,
      });
      expect(() => parseJsonSection(source)).toThrow();
    });

    it("throws when files is not an object", () => {
      const source = JSON.stringify({
        files: "not an object",
      });
      expect(() => parseJsonSection(source)).toThrow();
    });

    it("throws when file content is not a string", () => {
      const source = JSON.stringify({
        files: {
          "test.txt": 123,
        },
      });
      expect(() => parseJsonSection(source)).toThrow();
    });

    it("handles file paths with special characters", () => {
      const source = JSON.stringify({
        files: {
          "src/my-file.js": "code",
        },
      });
      const result = parseJsonSection(source);
      expect(result[0]?.path).toBe("src/my-file.js");
    });

    it("handles multiline content in JSON strings", () => {
      const source = JSON.stringify({
        files: {
          "multi.txt": "line1\nline2\nline3",
        },
      });
      const result = parseJsonSection(source);
      expect(result[0]?.content).toBe("line1\nline2\nline3");
    });

    it("handles empty content string", () => {
      const source = JSON.stringify({
        files: {
          "empty.txt": "",
        },
      });
      const result = parseJsonSection(source);
      expect(result[0]?.content).toBe("");
    });

    it("preserves file order from JSON object", () => {
      const source = JSON.stringify({
        files: {
          "z.txt": "z",
          "a.txt": "a",
          "m.txt": "m",
        },
      });
      const result = parseJsonSection(source);
      // Order may vary due to object key ordering in JSON
      expect(result.map((f) => f.path).sort()).toEqual([
        "a.txt",
        "m.txt",
        "z.txt",
      ]);
    });

    it("handles files field with extra properties in root", () => {
      const source = JSON.stringify({
        files: { "test.txt": "content" },
        other: "ignored",
        metadata: { version: "1" },
      });
      const result = parseJsonSection(source);
      expect(result).toHaveLength(1);
      expect(result[0]?.path).toBe("test.txt");
    });

    it("handles empty files object", () => {
      const source = JSON.stringify({
        files: {},
      });
      const result = parseJsonSection(source);
      expect(result).toEqual([]);
    });

    it("throws when JSON file content is null", () => {
      const source = JSON.stringify({
        files: { "test.txt": null },
      });
      expect(() => parseJsonSection(source)).toThrow();
    });
  });

  describe("parseMarkdownSection", () => {
    it("parses markdown file blocks and ignores unrelated text", () => {
      const source = [
        "Intro text",
        "## File: a.txt",
        "```ts",
        "alpha",
        "```",
        "",
        "## File: b.txt",
        "````",
        "beta",
        "````",
      ].join("\n");

      const result = parseMarkdownSection(source);
      expect(result).toEqual([
        { path: "a.txt", content: "alpha" },
        { path: "b.txt", content: "beta" },
      ]);
    });

    it("throws when a markdown file block is missing its fence", () => {
      const source = ["## File: broken.txt", "content"].join("\n");
      expect(() => parseMarkdownSection(source)).toThrow();
    });

    it("throws when a markdown file block is unterminated", () => {
      const source = ["## File: broken.txt", "```", "content"].join("\n");
      expect(() => parseMarkdownSection(source)).toThrow();
    });

    it("skips non file headings before the first file block", () => {
      const source = [
        "# Title",
        "Some intro",
        "## File: one.txt",
        "```",
        "content",
        "```",
      ].join("\n");

      const result = parseMarkdownSection(source);
      expect(result).toEqual([{ path: "one.txt", content: "content" }]);
    });
  });

  describe("parsePlainSection", () => {
    it("parses plain sections with multiple files and trims trailing blank lines", () => {
      const longSeparator = "=".repeat(64);
      const shortSeparator = "=".repeat(16);
      const source = [
        longSeparator,
        "Files",
        longSeparator,
        "",
        shortSeparator,
        "File: a.txt",
        shortSeparator,
        "alpha",
        "",
        shortSeparator,
        "File: b.txt",
        shortSeparator,
        "beta",
        longSeparator,
        "End of Codebase",
      ].join("\n");

      const result = parsePlainSection(source);
      expect(result).toEqual([
        { path: "a.txt", content: "alpha" },
        { path: "b.txt", content: "beta" },
      ]);
    });

    it("throws on invalid plain section structure", () => {
      expect(() => parsePlainSection("not a valid section")).toThrow();
    });

    it("throws on invalid plain section file header", () => {
      const longSeparator = "=".repeat(64);
      const shortSeparator = "=".repeat(16);
      const source = [
        longSeparator,
        "Files",
        longSeparator,
        "",
        shortSeparator,
        "Missing header",
        shortSeparator,
      ].join("\n");

      expect(() => parsePlainSection(source)).toThrow();
    });

    it("throws on invalid plain section separator line", () => {
      const longSeparator = "=".repeat(64);
      const source = [
        longSeparator,
        "Files",
        longSeparator,
        "",
        "- not-a-separator -",
        "File: a.txt",
        "================",
      ].join("\n");

      expect(() => parsePlainSection(source)).toThrow();
    });

    it("skips leading blank lines before the first file block", () => {
      const longSeparator = "=".repeat(64);
      const shortSeparator = "=".repeat(16);
      const source = [
        longSeparator,
        "Files",
        longSeparator,
        "",
        "",
        shortSeparator,
        "File: a.txt",
        shortSeparator,
        "alpha",
        longSeparator,
        "End of Codebase",
      ].join("\n");

      const result = parsePlainSection(source);
      expect(result).toEqual([{ path: "a.txt", content: "alpha" }]);
    });

    it("parses two plain-section file blocks and stops at the next header", () => {
      const longSeparator = "=".repeat(64);
      const shortSeparator = "=".repeat(16);
      const source = [
        longSeparator,
        "Files",
        longSeparator,
        "",
        shortSeparator,
        "File: a.txt",
        shortSeparator,
        "alpha",
        shortSeparator,
        "File: b.txt",
        shortSeparator,
        "beta",
        longSeparator,
        "End of Codebase",
      ].join("\n");

      const result = parsePlainSection(source);
      expect(result).toEqual([
        { path: "a.txt", content: "alpha" },
        { path: "b.txt", content: "beta" },
      ]);
    });

    it("stops a file block when the next block header begins", () => {
      const longSeparator = "=".repeat(64);
      const shortSeparator = "=".repeat(16);
      const source = [
        longSeparator,
        "Files",
        longSeparator,
        "",
        shortSeparator,
        "File: a.txt",
        shortSeparator,
        "alpha",
        "",
        shortSeparator,
        "File: b.txt",
        shortSeparator,
        "beta",
        "",
        longSeparator,
        "End of Codebase",
      ].join("\n");

      const result = parsePlainSection(source);
      expect(result).toHaveLength(2);
      expect(result[0]?.content).toBe("alpha");
      expect(result[1]?.content).toBe("beta");
    });

    it("breaks after file content when the next header begins", () => {
      const longSeparator = "=".repeat(64);
      const shortSeparator = "=".repeat(16);
      const source = [
        longSeparator,
        "Files",
        longSeparator,
        "",
        shortSeparator,
        "File: a.txt",
        shortSeparator,
        "alpha",
        shortSeparator,
        "File: b.txt",
        shortSeparator,
        "beta",
        longSeparator,
        "End of Codebase",
      ].join("\n");

      const result = parsePlainSection(source);
      expect(result).toEqual([
        { path: "a.txt", content: "alpha" },
        { path: "b.txt", content: "beta" },
      ]);
    });
  });
});
