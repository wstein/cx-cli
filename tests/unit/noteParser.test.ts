// test-lane: unit
import { describe, expect, it } from "vitest";
import {
  extractNoteSummary,
  parseMarkdownFrontmatter,
  titleFromFileName,
  validateNoteIdFormat,
} from "../../src/notes/parser.js";

describe("notes parser", () => {
  describe("validateNoteIdFormat", () => {
    it("accepts valid note ID from January 1, 2024 at 00:00:00", () => {
      const result = validateNoteIdFormat("20240101000000");
      expect(result).toBe(true);
    });

    it("accepts valid note ID from December 31, 2024 at 23:59:59", () => {
      const result = validateNoteIdFormat("20241231235959");
      expect(result).toBe(true);
    });

    it("accepts valid note ID from February 29 on leap year", () => {
      // 2024 is a leap year
      const result = validateNoteIdFormat("20240229120000");
      expect(result).toBe(true);
    });

    it("rejects non-leap year February 29", () => {
      // 2023 is not a leap year
      const result = validateNoteIdFormat("20230229120000");
      expect(result).toBe(false);
    });

    it("rejects invalid month (00)", () => {
      const result = validateNoteIdFormat("20240001000000");
      expect(result).toBe(false);
    });

    it("rejects invalid month (13)", () => {
      const result = validateNoteIdFormat("20241301000000");
      expect(result).toBe(false);
    });

    it("rejects invalid day (00)", () => {
      const result = validateNoteIdFormat("20240100000000");
      expect(result).toBe(false);
    });

    it("rejects invalid day (32)", () => {
      const result = validateNoteIdFormat("20240132000000");
      expect(result).toBe(false);
    });

    it("rejects February 30", () => {
      const result = validateNoteIdFormat("20240230000000");
      expect(result).toBe(false);
    });

    it("rejects invalid hour (24)", () => {
      const result = validateNoteIdFormat("20240101240000");
      expect(result).toBe(false);
    });

    it("accepts valid hour (23)", () => {
      const result = validateNoteIdFormat("20240101230000");
      expect(result).toBe(true);
    });

    it("rejects invalid minute (60)", () => {
      const result = validateNoteIdFormat("20240101006000");
      expect(result).toBe(false);
    });

    it("accepts valid minute (59)", () => {
      const result = validateNoteIdFormat("20240101005900");
      expect(result).toBe(true);
    });

    it("rejects invalid second (60)", () => {
      const result = validateNoteIdFormat("20240101000060");
      expect(result).toBe(false);
    });

    it("accepts valid second (59)", () => {
      const result = validateNoteIdFormat("20240101000059");
      expect(result).toBe(true);
    });

    it("rejects ID too short", () => {
      const result = validateNoteIdFormat("202401010000");
      expect(result).toBe(false);
    });

    it("rejects ID too long", () => {
      const result = validateNoteIdFormat("202401010000001");
      expect(result).toBe(false);
    });

    it("rejects non-numeric ID", () => {
      const result = validateNoteIdFormat("2024010100a0b0");
      expect(result).toBe(false);
    });

    it("rejects empty string", () => {
      const result = validateNoteIdFormat("");
      expect(result).toBe(false);
    });

    it("rejects alphanumeric mix", () => {
      const result = validateNoteIdFormat("202401010000ab");
      expect(result).toBe(false);
    });
  });

  describe("parseMarkdownFrontmatter", () => {
    it("parses valid YAML frontmatter", () => {
      const content = "---\ntitle: My Note\nid: 12345\n---\nBody content";
      const result = parseMarkdownFrontmatter(content);
      expect(result.frontmatter).toEqual({ title: "My Note", id: "12345" });
      expect(result.body).toBe("Body content");
    });

    it("returns empty frontmatter when no frontmatter present", () => {
      const content = "No frontmatter here";
      const result = parseMarkdownFrontmatter(content);
      expect(result.frontmatter).toEqual({});
      expect(result.body).toBe("No frontmatter here");
    });

    it("returns frontmatter and body with no closing delimiter detected", () => {
      const content = "---\ntitle: My Note\n(no closing delimiter)";
      const result = parseMarkdownFrontmatter(content);
      expect(result.frontmatter).toEqual({});
      expect(result.body).toBe("---\ntitle: My Note\n(no closing delimiter)");
    });

    it("handles CRLF line endings in frontmatter", () => {
      const content = "---\r\ntitle: My Note\r\nid: 123\r\n---\r\nBody";
      const result = parseMarkdownFrontmatter(content);
      expect(result.frontmatter.title).toBe("My Note");
      expect(result.body).toBe("Body");
    });

    it("handles mixed line endings", () => {
      const content = "---\r\ntitle: My Note\nid: 123\r\n---\nBody";
      const result = parseMarkdownFrontmatter(content);
      expect(result.frontmatter.title).toBe("My Note");
      expect(result.body).toBe("Body");
    });

    it("trims whitespace from values", () => {
      const content =
        "---\ntitle:   My Note   \nauthor:  John Doe  \n---\nBody";
      const result = parseMarkdownFrontmatter(content);
      expect(result.frontmatter.title).toBe("My Note");
      expect(result.frontmatter.author).toBe("John Doe");
    });

    it("parses boolean true values", () => {
      const content = "---\npublished: true\ndraft: false\n---\nBody";
      const result = parseMarkdownFrontmatter(content);
      expect(result.frontmatter.published).toBe(true);
      expect(result.frontmatter.draft).toBe(false);
    });

    it("parses numeric values as strings", () => {
      const content = "---\ncount: 42\nversion: 1.0\n---\nBody";
      const result = parseMarkdownFrontmatter(content);
      expect(result.frontmatter.count).toBe("42");
      expect(result.frontmatter.version).toBe("1.0");
    });

    it("skips lines without colons in frontmatter", () => {
      const content =
        "---\ntitle: My Note\ninvalid line\nauthor: John\n---\nBody";
      const result = parseMarkdownFrontmatter(content);
      expect(result.frontmatter.title).toBe("My Note");
      expect(result.frontmatter.author).toBe("John");
      expect(result.frontmatter["invalid line"]).toBeUndefined();
    });

    it("preserves original body content", () => {
      const content = "---\ntitle: Note\n---\nBody with\nmultiple\nlines";
      const result = parseMarkdownFrontmatter(content);
      expect(result.body).toBe("Body with\nmultiple\nlines");
    });

    it("handles empty frontmatter (just delimiters)", () => {
      const content = "---\n---\nBody";
      const result = parseMarkdownFrontmatter(content);
      expect(result.frontmatter).toEqual({});
      expect(result.body).toBe("Body");
    });

    it("handles value with colon in it", () => {
      const content = "---\nurl: https://example.com\n---\nBody";
      const result = parseMarkdownFrontmatter(content);
      expect(result.frontmatter.url).toBe("https://example.com");
    });

    it("handles empty string values", () => {
      const content = "---\ntitle: \ndescription:\n---\nBody";
      const result = parseMarkdownFrontmatter(content);
      expect(result.frontmatter.title).toBe("");
      expect(result.frontmatter.description).toBe("");
    });

    it("handles special characters in keys", () => {
      const content = "---\nmy-key: value\nmy_key: value2\n---\nBody";
      const result = parseMarkdownFrontmatter(content);
      expect(result.frontmatter["my-key"]).toBe("value");
      expect(result.frontmatter.my_key).toBe("value2");
    });

    it("handles body starting with empty lines", () => {
      const content = "---\ntitle: Note\n---\n\n\nBody starts here";
      const result = parseMarkdownFrontmatter(content);
      expect(result.body.startsWith("\n")).toBe(true);
    });

    it("handles tabs in frontmatter values", () => {
      const content = "---\ntitle:\tTabbed\tValue\n---\nBody";
      const result = parseMarkdownFrontmatter(content);
      expect(result.frontmatter.title).toBe("Tabbed\tValue");
    });

    it("handles null values", () => {
      const content = "---\nvalue: null\n---\nBody";
      const result = parseMarkdownFrontmatter(content);
      expect(result.frontmatter.value).toBe(null);
    });

    it("returns entire content as body when starting with non-frontmatter", () => {
      const content = "Not starting with ---\n---\ntitle: Note\n---";
      const result = parseMarkdownFrontmatter(content);
      expect(result.frontmatter).toEqual({});
      expect(result.body).toBe(content);
    });

    it("parses arrays and quoted values in frontmatter", () => {
      const content = [
        "---",
        "tags: [\"alpha\", beta, 'gamma']",
        "status: 'draft'",
        'summary: "Hello world"',
        "---",
        "Body",
      ].join("\n");

      const result = parseMarkdownFrontmatter(content);
      expect(result.frontmatter.tags).toEqual(["alpha", "beta", "gamma"]);
      expect(result.frontmatter.status).toBe("draft");
      expect(result.frontmatter.summary).toBe("Hello world");
    });
  });

  describe("titleFromFileName", () => {
    it("strips timestamp prefixes from note filenames", () => {
      expect(titleFromFileName("20240101010203-my-note.md")).toBe("my-note");
    });

    it("returns the basename when no timestamp prefix exists", () => {
      expect(titleFromFileName("plain-note.md")).toBe("plain-note");
    });
  });

  describe("extractNoteSummary", () => {
    it("normalizes markdown formatting and stops at the links section", () => {
      const body = [
        "This has a [[Wiki Link]] and a [Markdown Link](https://example.com) with `code`.",
        "",
        "## Details",
        "This paragraph should not be included.",
        "",
        "## Links",
        "- ignored",
      ].join("\n");

      expect(extractNoteSummary(body)).toBe(
        "This has a Wiki Link and a Markdown Link with code.",
      );
    });

    it("skips a leading heading before the first paragraph", () => {
      const body = [
        "## Overview",
        "This paragraph should become the summary.",
      ].join("\n");

      expect(extractNoteSummary(body)).toBe(
        "This paragraph should become the summary.",
      );
    });

    it("stops after the first paragraph when a heading follows", () => {
      const body = [
        "First paragraph stays in the summary.",
        "",
        "## Details",
        "This paragraph should be ignored.",
      ].join("\n");

      expect(extractNoteSummary(body)).toBe(
        "First paragraph stays in the summary.",
      );
    });

    it("truncates summaries longer than 240 characters", () => {
      const body = ` ${"Long summary text ".repeat(20)} `;
      const summary = extractNoteSummary(body);

      expect(summary.length).toBe(240);
      expect(summary.endsWith("...")).toBe(true);
    });
  });
});
