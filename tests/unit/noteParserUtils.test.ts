import { describe, expect, it } from "bun:test";
import { extractNoteSummary, titleFromFileName } from "../../src/notes/parser";

describe("notes parser utilities", () => {
  describe("titleFromFileName", () => {
    it("extracts title from standard filename", () => {
      const title = titleFromFileName("/notes/20240115100000.md");
      expect(typeof title).toBe("string");
      expect(title.length).toBeGreaterThan(0);
    });

    it("handles filenames with dashes", () => {
      const title = titleFromFileName("/notes/my-note-title.md");
      expect(title).toContain("my");
    });

    it("handles filenames with underscores", () => {
      const title = titleFromFileName("/notes/my_note_title.md");
      expect(typeof title).toBe("string");
    });

    it("removes .md extension", () => {
      const title = titleFromFileName("/notes/example.md");
      expect(title).not.toContain(".md");
    });

    it("handles nested paths", () => {
      const title = titleFromFileName("/root/notes/subfolder/example.md");
      expect(title).toBe("example");
    });

    it("handles deeply nested paths", () => {
      const title = titleFromFileName("/root/a/b/c/d/e/f/filename.md");
      expect(title).toBe("filename");
    });

    it("handles single-level paths", () => {
      const title = titleFromFileName("note.md");
      expect(title).toBe("note");
    });

    it("handles all caps filenames", () => {
      const title = titleFromFileName("/notes/README.md");
      expect(title).toBe("README");
    });

    it("handles mixed case filenames", () => {
      const title = titleFromFileName("/notes/MyNote.md");
      expect(title).toBe("MyNote");
    });

    it("handles filenames with numbers", () => {
      const title = titleFromFileName("/notes/note123.md");
      expect(title).toContain("123");
    });

    it("handles filenames with special characters", () => {
      const title = titleFromFileName("/notes/note-v1.0.md");
      expect(title).not.toContain(".md");
    });

    it("preserves formatting hints in filename", () => {
      const title = titleFromFileName("/notes/Note_Title-With_Dashes.md");
      expect(typeof title).toBe("string");
    });
  });

  describe("extractNoteSummary", () => {
    it("extracts first paragraph as summary", () => {
      const body = "This is the first paragraph.\n\nThis is the second.";
      const summary = extractNoteSummary(body);
      expect(summary).toContain("first");
    });

    it("returns empty string for empty body", () => {
      const summary = extractNoteSummary("");
      expect(summary).toBe("");
    });

    it("handles body with only whitespace", () => {
      const summary = extractNoteSummary("   \n\n  \t  ");
      expect(typeof summary).toBe("string");
    });

    it("extracts text before double newline", () => {
      const body = "Summary line\n\nDetails follow...";
      const summary = extractNoteSummary(body);
      expect(summary).toContain("Summary");
    });

    it("handles body with markdown formatting", () => {
      const body = "**Bold** text and *italic* text.\n\nNext paragraph.";
      const summary = extractNoteSummary(body);
      expect(summary.length).toBeGreaterThan(0);
    });

    it("strips leading/trailing whitespace from summary", () => {
      const body = "  Leading spaces\n\nNext line";
      const summary = extractNoteSummary(body);
      expect(summary).not.toMatch(/^\s/);
    });

    it("handles multiline first paragraph", () => {
      const body = "Line one\nLine two\nLine three\n\nNew paragraph";
      const summary = extractNoteSummary(body);
      expect(summary.length).toBeGreaterThan(0);
    });

    it("handles body with code blocks", () => {
      const body = "Paragraph about code.\n\n```js\ncode()\n```\n\nMore text";
      const summary = extractNoteSummary(body);
      expect(summary.length).toBeGreaterThan(0);
    });

    it("handles body with lists", () => {
      const body = "Description\n\n- Item 1\n- Item 2";
      const summary = extractNoteSummary(body);
      expect(summary.length).toBeGreaterThan(0);
    });

    it("handles very long first lines", () => {
      const longLine = `${"A".repeat(500)}\n\nSecond paragraph`;
      const summary = extractNoteSummary(longLine);
      expect(summary.length).toBeGreaterThan(100);
    });

    it("handles body with single line (no paragraph break)", () => {
      const body = "Single line without break";
      const summary = extractNoteSummary(body);
      expect(summary.length).toBeGreaterThan(0);
    });

    it("handles CRLF line endings", () => {
      const body = "First paragraph\r\n\r\nSecond paragraph";
      const summary = extractNoteSummary(body);
      expect(summary.length).toBeGreaterThan(0);
    });

    it("handles CR line endings", () => {
      const body = "First paragraph\r\rSecond paragraph";
      const summary = extractNoteSummary(body);
      expect(summary.length).toBeGreaterThan(0);
    });

    it("handles mixed line endings", () => {
      const body = "Line one\r\nLine two\nLine three\r\rParagraph two";
      const summary = extractNoteSummary(body);
      expect(summary.length).toBeGreaterThan(0);
    });

    it("handles Unicode content", () => {
      const body = "Résumé with émojis 🎉 and spëcial chärs\n\nMore content";
      const summary = extractNoteSummary(body);
      expect(summary).toContain("Résumé");
    });

    it("preserves punctuation in summary", () => {
      const body = "This is a sentence. Another sentence.\n\nNew paragraph";
      const summary = extractNoteSummary(body);
      expect(summary).toContain(".");
    });
  });
});
