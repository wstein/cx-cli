// test-lane: unit
import { describe, expect, it } from "vitest";
import {
  readSpanContent,
  splitOutputLines,
} from "../../src/extract/lineSpans.js";

describe("extract line spans", () => {
  describe("splitOutputLines", () => {
    it("splits content by newlines", () => {
      const result = splitOutputLines("line1\nline2\nline3");
      expect(result).toEqual(["line1", "line2", "line3"]);
    });

    it("handles empty input", () => {
      const result = splitOutputLines("");
      expect(result).toEqual([""]);
    });

    it("preserves single line without newline", () => {
      const result = splitOutputLines("single line");
      expect(result).toEqual(["single line"]);
    });

    it("handles mixed line endings (CRLF)", () => {
      const result = splitOutputLines("line1\r\nline2\r\nline3");
      expect(result).toEqual(["line1\r", "line2\r", "line3"]);
    });

    it("handles trailing newline", () => {
      const result = splitOutputLines("line1\nline2\n");
      expect(result).toEqual(["line1", "line2", ""]);
    });

    it("handles multiple consecutive newlines", () => {
      const result = splitOutputLines("line1\n\n\nline2");
      expect(result).toEqual(["line1", "", "", "line2"]);
    });
  });

  describe("readSpanContent", () => {
    const lines = ["line1", "line2", "line3", "line4", "line5"];

    it("reads content between start and end lines", () => {
      const result = readSpanContent(lines, 2, 4);
      expect(result).toBe("line2\nline3\nline4");
    });

    it("reads single line span", () => {
      const result = readSpanContent(lines, 3, 3);
      expect(result).toBe("line3");
    });

    it("reads from line 1 to end", () => {
      const result = readSpanContent(lines, 1, 5);
      expect(result).toBe("line1\nline2\nline3\nline4\nline5");
    });

    it("returns undefined when startLine is null", () => {
      const result = readSpanContent(lines, null, 3);
      expect(result).toBeUndefined();
    });

    it("returns undefined when endLine is null", () => {
      const result = readSpanContent(lines, 1, null);
      expect(result).toBeUndefined();
    });

    it("returns undefined when both are null", () => {
      const result = readSpanContent(lines, null, null);
      expect(result).toBeUndefined();
    });

    it("returns undefined when startLine is 0 (invalid)", () => {
      const result = readSpanContent(lines, 0, 3);
      expect(result).toBeUndefined();
    });

    it("returns undefined when endLine < startLine", () => {
      const result = readSpanContent(lines, 4, 2);
      expect(result).toBeUndefined();
    });

    it("returns undefined when startLine > array length", () => {
      const result = readSpanContent(lines, 10, 15);
      expect(result).toBeUndefined();
    });

    it("returns undefined when endLine > array length", () => {
      const result = readSpanContent(lines, 2, 10);
      expect(result).toBeUndefined();
    });

    it("returns undefined when startLine < 1 (negative)", () => {
      const result = readSpanContent(lines, -1, 3);
      expect(result).toBeUndefined();
    });

    it("handles empty array", () => {
      const result = readSpanContent([], 1, 1);
      expect(result).toBeUndefined();
    });

    it("handles single element array", () => {
      const result = readSpanContent(["only"], 1, 1);
      expect(result).toBe("only");
    });

    it("returns undefined with negative endLine", () => {
      const result = readSpanContent(lines, 1, -1);
      expect(result).toBeUndefined();
    });
  });
});
