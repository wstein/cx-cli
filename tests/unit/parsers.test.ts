import { describe, expect, it } from "bun:test";
import { parseJsonSection, parseXmlSection } from "../../src/extract/parsers";

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
      const source =
        '<file path="code.js">\nline1\nline2\nline3\n</file>\n';
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
      const source =
        '<file path="test.txt">\ncontent\n</file>  \t  \n';
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
  });
});
